import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, X, Check } from 'lucide-react'
import { motion } from 'motion/react'
import rosaryRaw from '../../data/rosary_contemplation.json'
import rosaryImagesRaw from '../../data/rosary_images.json'
import { prayedSetForWeekday, type SetKey } from '../../data/rosary'
import {
  ROSARY_STEPS,
  ROSARY_STEP_LABELS,
  ROSARY_TEXTS,
  stepText,
  gloriaText,
  type Lang,
  type RosaryStep,
} from '../../data/rosaryEngine'
import { HapticTapArea } from './HapticTapArea'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { PRACTICE_TEXT_LANG_KEY } from '../../data/bundledTexts'
import { formatDate } from '../../utils/dates'

interface RosaryMystery {
  title: string
  quotes: string[]
}
interface RosarySet {
  label: string
  vocalDays: number[]
  mysteries: RosaryMystery[]
}
interface ImageCandidate {
  f: string // path relative to /rosary-images/
  a: string // painter (caption)
}

const sets = (rosaryRaw as unknown as { sets: Record<SetKey, RosarySet> }).sets
const images = rosaryImagesRaw as unknown as Record<SetKey, ImageCandidate[][]>

// Mid-prayer progress, device-local on purpose (never synced): a half-prayed
// rosary belongs to the phone in your hand. Restored only for the same day and
// set; finishing (or a new day) clears it.
const STORAGE_KEY = 'rosary-engine-progress'

interface SavedProgress {
  dateStr: string
  setKey: SetKey
  stepIndex: number
  quoteIdx: number[]
  imgIdx: number[]
}

function randomIdx(n: number): number {
  return Math.floor(Math.random() * Math.max(1, n))
}

function initSession(dateStr: string, setKey: SetKey, set: RosarySet, imgs: ImageCandidate[][]) {
  const fresh = () => ({
    stepIndex: 0,
    quoteIdx: set.mysteries.map((m) => randomIdx(m.quotes.length)),
    imgIdx: set.mysteries.map((_, i) => randomIdx((imgs[i] ?? []).length)),
  })
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh()
    const saved = JSON.parse(raw) as SavedProgress
    if (saved.dateStr !== dateStr || saved.setKey !== setKey) return fresh()
    if (!Number.isInteger(saved.stepIndex) || saved.stepIndex < 0 || saved.stepIndex >= ROSARY_STEPS.length)
      return fresh()
    if (!Array.isArray(saved.quoteIdx) || saved.quoteIdx.length !== set.mysteries.length) return fresh()
    if (!Array.isArray(saved.imgIdx) || saved.imgIdx.length !== set.mysteries.length) return fresh()
    return { stepIndex: saved.stepIndex, quoteIdx: saved.quoteIdx, imgIdx: saved.imgIdx }
  } catch {
    return fresh()
  }
}

// Each decade block is anuncio + Pai Nosso + 10 Aves + Glória + Fátima = 14
// steps, after the single abertura step.
const DECADE_LENGTH = 14
const anuncioStepIndex = (mystery: number) => 1 + mystery * DECADE_LENGTH

interface RosaryPrayerViewProps {
  // The practice id — drives the complete-toggle / streaks.
  practiceId: string
  // The day being viewed in DailyView; its weekday picks the prayed set.
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * Full-screen engine to PRAY the rosary as in Opus Dei, bead by bead. A tap
 * anywhere advances one step; prayed-from-memory steps (Pai Nosso, Aves,
 * Glória, Fátima) land on a visually-hidden iOS switch and tick
 * (HapticTapArea), the look-at-the-screen steps (anúncio and the scroll pages)
 * are deliberately silent. Finishing the flow marks the "Santo Rosário"
 * practice done.
 */
export function RosaryPrayerView({
  practiceId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onClose,
}: RosaryPrayerViewProps) {
  const dateStr = formatDate(viewDate)
  const setKey = prayedSetForWeekday(viewDate)
  const set = sets[setKey]
  const imgs = images[setKey] ?? []

  // Session picks (one quote + one painting per mystery, stable through the
  // whole rosary) and the resume position, restored from a same-day interrupt.
  const [session] = useState(() => initSession(dateStr, setKey, set, imgs))
  const { quoteIdx, imgIdx } = session
  const [stepIndex, setStepIndex] = useState(session.stepIndex)
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(PRACTICE_TEXT_LANG_KEY)
    return saved === 'la' ? 'la' : 'pt'
  })

  useEffect(() => {
    localStorage.setItem(PRACTICE_TEXT_LANG_KEY, lang)
  }, [lang])

  useEffect(() => {
    // Step 0 is never worth saving — and NOT writing it means merely opening
    // the engine on some other day can't clobber a half-prayed rosary's save.
    if (stepIndex === 0) return
    const progress: SavedProgress = { dateStr, setKey, stepIndex, quoteIdx, imgIdx }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [dateStr, setKey, stepIndex, quoteIdx, imgIdx])

  // Lock body scroll: this is a full-screen reader.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const step: RosaryStep = ROSARY_STEPS[stepIndex]
  const isLast = stepIndex === ROSARY_STEPS.length - 1

  // A double-tap on "Terminar" must not toggle the practice twice (the second
  // toggle would un-mark it) — the exit animation keeps the overlay tappable
  // for a moment after the first tap.
  const finishedRef = useRef(false)
  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    localStorage.removeItem(STORAGE_KEY)
    if (!isCompleted(practiceId)) onTogglePractice(practiceId)
    onClose()
  }, [isCompleted, onTogglePractice, onClose, practiceId])

  const goNext = useCallback(() => {
    if (isLast) finish()
    else setStepIndex((i) => i + 1)
  }, [isLast, finish])
  const goBack = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), [])

  // Arrow-key navigation (desktop / PWA on laptop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goBack()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack, goNext])

  const completed = isCompleted(practiceId)
  const m = step.mysteryIndex
  const mystery = m !== undefined ? set.mysteries[m] : undefined
  const quote = m !== undefined ? (mystery?.quotes[quoteIdx[m]] ?? mystery?.quotes[0]) : undefined
  const img = m !== undefined ? (imgs[m]?.[imgIdx[m]] ?? imgs[m]?.[0]) : undefined
  const imgSrc = img ? `${import.meta.env.BASE_URL}rosary-images/${img.f}` : undefined
  const mysteryTitle =
    m !== undefined
      ? lang === 'la'
        ? (ROSARY_TEXTS.mysteryTitlesLa[setKey]?.[m] ?? mystery?.title)
        : mystery?.title
      : undefined

  // Which decade the footer dots highlight: none before the first announcement,
  // all done once the decades are behind us.
  const activeMystery = m ?? (stepIndex === 0 ? -1 : set.mysteries.length)

  const triduumGloria = step.kind === 'gloria' ? gloriaText(viewDate, lang) : null
  const label =
    step.kind === 'anuncio'
      ? 'Anúncio do mistério'
      : triduumGloria
        ? 'Em vez do Glória'
        : ROSARY_STEP_LABELS[step.kind][lang]
  const scrollMarkdown = step.scroll ? stepText(step.kind, lang) : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark"
    >
      {/* Header */}
      <header className="shrink-0 border-b border-border dark:border-border-dark pt-[var(--safe-area-top)]">
        <div className="flex items-center gap-1 px-2 h-14">
          <button
            onClick={onClose}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
              Santo Rosário
            </p>
            <h1 className="font-heading text-base font-semibold text-primary dark:text-primary-light truncate mt-0.5">
              {set.label}
            </h1>
          </div>
          <button
            onClick={() => setLang((l) => (l === 'pt' ? 'la' : 'pt'))}
            className="px-2.5 py-1.5 rounded-full text-xs font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
            aria-label={lang === 'pt' ? 'Mudar para latim' : 'Mudar para português'}
          >
            {lang === 'pt' ? 'LA' : 'PT'}
          </button>
          <motion.button
            onClick={() => onTogglePractice(practiceId)}
            whileTap={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-7 h-7 ml-1 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${
              completed
                ? 'bg-btn border-[1.5px] border-btn dark:bg-btn-dark dark:border-btn-dark'
                : 'border-[1.5px] border-border dark:border-border-dark'
            }`}
            aria-label={completed ? 'Desmarcar' : 'Marcar como feito'}
          >
            {completed && (
              <Check className="w-4 h-4 text-btn-text dark:text-btn-dark-text" strokeWidth={3} />
            )}
          </motion.button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {step.scroll ? (
          // Long-text steps: scroll freely, advance via the footer button.
          <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-6 py-6">
              {step.kind !== 'ladainha' && (
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading mb-4">
                  {label}
                </p>
              )}
              {scrollMarkdown && <MarkdownRenderer markdown={scrollMarkdown} className="prose-prayer" />}
            </div>
          </div>
        ) : step.kind === 'ave-final' ? (
          // The three closing Ave Marias — ticking taps, current line highlighted.
          <HapticTapArea haptic onTap={goNext} className="h-full flex flex-col cursor-pointer select-none">
            <div className="flex-1 overflow-y-auto flex items-center">
              <div className="mx-auto w-full max-w-2xl px-6 py-8 space-y-6">
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
                  Ao terminar os cinco mistérios
                </p>
                {ROSARY_TEXTS.avesFinais.pt.map((line, i) => (
                  <p
                    key={i}
                    className={`text-lg leading-relaxed transition-colors ${
                      i === step.aveIndex
                        ? 'text-text-primary dark:text-text-primary-dark font-medium'
                        : 'text-text-muted dark:text-text-muted-dark'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <PrayerBand label={label} beadIndex={step.aveIndex} beadCount={3} />
          </HapticTapArea>
        ) : (
          // Decade steps: the mystery's painting + quote stay up; the band below
          // names the current prayer. A tap anywhere advances (Aves tick).
          <HapticTapArea
            haptic={step.haptic}
            onTap={goNext}
            className="h-full flex flex-col cursor-pointer select-none"
          >
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-2xl">
                {imgSrc && (
                  <div className="w-full flex justify-center bg-surface-secondary dark:bg-surface-secondary-dark">
                    <img
                      src={imgSrc}
                      alt={mystery?.title}
                      className="max-h-[45vh] w-auto max-w-full object-contain select-none"
                      draggable={false}
                    />
                  </div>
                )}
                <div className="px-6 py-4 space-y-2">
                  <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
                    Mistério {(m ?? 0) + 1} de {set.mysteries.length}
                  </p>
                  <h2 className="font-heading text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                    {mysteryTitle}
                  </h2>
                  <p className="text-base italic text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                    {quote}
                  </p>
                  {img?.a && (
                    <p className="text-xs text-text-muted dark:text-text-muted-dark pt-1">Arte: {img.a}</p>
                  )}
                </div>
              </div>
            </div>
            <PrayerBand
              label={label}
              beadIndex={step.kind === 'ave' ? step.aveIndex : undefined}
              beadCount={step.kind === 'ave' ? 10 : undefined}
              hint={step.kind === 'anuncio' ? 'Toque para avançar' : undefined}
            >
              {step.kind === 'fatima' && (
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed text-center">
                  {ROSARY_TEXTS.fatima.pt}
                </p>
              )}
              {triduumGloria && (
                <MarkdownRenderer markdown={triduumGloria} className="prose-prayer text-center" />
              )}
            </PrayerBand>
          </HapticTapArea>
        )}
      </div>

      {/* Footer: back + decade dots (or the advance button on text steps) */}
      <footer className="shrink-0 border-t border-border dark:border-border-dark pb-[var(--safe-area-bottom)]">
        <div className="flex items-center gap-3 px-4 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Passo anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {step.scroll ? (
            <button
              onClick={goNext}
              className="flex-1 h-11 rounded-xl bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text font-medium transition-transform active:scale-[0.98]"
            >
              {isLast ? 'Terminar o Rosário' : 'Continuar'}
            </button>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center gap-2">
                {set.mysteries.map((mst, i) => (
                  <button
                    key={mst.title}
                    onClick={() => setStepIndex(anuncioStepIndex(i))}
                    aria-label={`Ir para o ${i + 1}º mistério`}
                    className={`h-2 rounded-full transition-all ${
                      i === activeMystery
                        ? 'w-5 bg-primary dark:bg-primary-light'
                        : i < activeMystery
                          ? 'w-2 bg-primary dark:bg-primary-light opacity-50'
                          : 'w-2 bg-border dark:bg-border-dark'
                    }`}
                  />
                ))}
              </div>
              <div className="w-9" aria-hidden />
            </>
          )}
        </div>
      </footer>
    </motion.div>
  )
}

// The strip above the footer naming the current prayer, with bead dots for the
// Aves and room for the short spoken texts (Fátima, Triduum Glória).
function PrayerBand({
  label,
  beadIndex,
  beadCount,
  hint,
  children,
}: {
  label: string
  beadIndex?: number
  beadCount?: number
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="shrink-0 border-t border-border dark:border-border-dark px-6 py-3">
      <div className="mx-auto w-full max-w-2xl flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
          {label}
          {beadIndex !== undefined && beadCount !== undefined && (
            <span className="text-text-muted dark:text-text-muted-dark font-normal">
              {' '}
              · {beadIndex + 1} de {beadCount}
            </span>
          )}
        </p>
        {children}
        {beadIndex !== undefined && beadCount !== undefined && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: beadCount }).map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all ${
                  i === beadIndex
                    ? 'w-2.5 h-2.5 bg-primary dark:bg-primary-light'
                    : i < beadIndex
                      ? 'w-2 h-2 bg-primary dark:bg-primary-light opacity-50'
                      : 'w-2 h-2 bg-border dark:bg-border-dark'
                }`}
              />
            ))}
          </div>
        )}
        {hint && <p className="text-xs text-text-muted dark:text-text-muted-dark">{hint}</p>}
      </div>
    </div>
  )
}
