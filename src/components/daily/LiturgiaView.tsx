import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { Spinner } from '../shared/Spinner'
import { PRACTICE_TEXT_LANG_KEY } from '../../data/bundledTexts'
import { resolveLiturgyForDate, type LiturgyDay, type LiturgyColor } from '../../data/liturgy'

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500

type Lang = 'pt' | 'la'

const LANG_LABELS: Record<Lang, string> = {
  pt: 'Português',
  la: 'Latim',
}

// Liturgical color → a small dot in the header. Branco gets a ring since a plain
// white dot would vanish on light backgrounds.
const COLOR_DOT_CLASS: Record<LiturgyColor, string> = {
  Branco: 'bg-white ring-1 ring-inset ring-border dark:ring-border-dark',
  Verde: 'bg-emerald-500 dark:bg-emerald-400',
  Vermelho: 'bg-red-600 dark:bg-red-500',
  Roxo: 'bg-violet-600 dark:bg-violet-400',
  Rosa: 'bg-pink-400 dark:bg-pink-300',
}

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

interface LiturgiaSlide {
  key: string
  label: string
  referencia?: string
  titulo?: string
  refrao?: string
  textoPt: string
  textoLatim?: string
}

function firstOf<T>(arr?: T[]): T | undefined {
  return arr && arr.length > 0 ? arr[0] : undefined
}

// Slide order per LITURGY_PLAN.md §E, skipping any slide whose content is
// absent. Reading/psalm arrays carry alternates (multiple celebrations) — only
// the first is shown, except `leituras.extras` (Easter Vigil-style extra
// readings), where every entry becomes its own slide.
function buildSlides(data: LiturgyDay): LiturgiaSlide[] {
  const slides: LiturgiaSlide[] = []

  if (data.antifonas?.entrada) {
    slides.push({ key: 'antifona-entrada', label: 'Antífona de entrada', textoPt: data.antifonas.entrada })
  }

  const leitura1 = firstOf(data.leituras.primeiraLeitura)
  if (leitura1) {
    slides.push({
      key: 'leitura-1',
      label: '1ª leitura',
      referencia: leitura1.referencia,
      titulo: leitura1.titulo,
      textoPt: leitura1.texto,
      textoLatim: leitura1.textoLatim,
    })
  }

  const salmo = firstOf(data.leituras.salmo)
  if (salmo) {
    slides.push({
      key: 'salmo',
      label: 'Salmo Responsorial',
      referencia: salmo.referencia,
      refrao: salmo.refrao,
      textoPt: salmo.texto,
      textoLatim: salmo.textoLatim,
    })
  }

  const leitura2 = firstOf(data.leituras.segundaLeitura)
  if (leitura2) {
    slides.push({
      key: 'leitura-2',
      label: '2ª leitura',
      referencia: leitura2.referencia,
      titulo: leitura2.titulo,
      textoPt: leitura2.texto,
      textoLatim: leitura2.textoLatim,
    })
  }

  ;(data.leituras.extras ?? []).forEach((extra, i) => {
    slides.push({
      key: `extra-${i}`,
      label: extra.tipo ?? 'Leitura',
      referencia: extra.referencia,
      titulo: extra.titulo,
      textoPt: extra.texto,
      textoLatim: extra.textoLatim,
    })
  })

  const evangelho = firstOf(data.leituras.evangelho)
  if (evangelho) {
    slides.push({
      key: 'evangelho',
      label: 'Evangelho',
      referencia: evangelho.referencia,
      titulo: evangelho.titulo,
      textoPt: evangelho.texto,
      textoLatim: evangelho.textoLatim,
    })
  }

  if (data.oracoes?.coleta) {
    slides.push({ key: 'coleta', label: 'Coleta', textoPt: data.oracoes.coleta })
  }
  if (data.oracoes?.oferendas) {
    slides.push({ key: 'oferendas', label: 'Oferendas', textoPt: data.oracoes.oferendas })
  }
  if (data.oracoes?.comunhao) {
    slides.push({ key: 'pos-comunhao', label: 'Após a Comunhão', textoPt: data.oracoes.comunhao })
  }
  if (data.antifonas?.comunhao) {
    slides.push({ key: 'antifona-comunhao', label: 'Antífona da comunhão', textoPt: data.antifonas.comunhao })
  }

  return slides
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: LiturgyDay }

interface LiturgiaViewProps {
  practiceId: string
  // The day being viewed in DailyView — past days must show that day's liturgy.
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onMarkViewed: (practiceId: string) => void
  onClose: () => void
}

/**
 * Full-screen reader for the day's Mass propers (entrance antiphon → readings →
 * psalm → gospel → collect/offertory/communion prayers → communion antiphon),
 * swipeable like AntiphonView. Unlike the other overlays it auto-marks the
 * practice on open — reading the day's liturgy IS the practice.
 */
export function LiturgiaView({
  practiceId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onMarkViewed,
  onClose,
}: LiturgiaViewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(PRACTICE_TEXT_LANG_KEY)
    return saved === 'la' ? 'la' : 'pt'
  })

  const load = useCallback(() => {
    let cancelled = false
    setState({ status: 'loading' })
    resolveLiturgyForDate(viewDate)
      .then((data) => {
        if (cancelled) return
        setIndex(0)
        setDirection(0)
        setState(data ? { status: 'ready', data } : { status: 'error' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [viewDate])

  useEffect(() => load(), [load])

  const slides = useMemo(() => (state.status === 'ready' ? buildSlides(state.data) : []), [state])

  // Lock body scroll: this is a full-screen reader.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(PRACTICE_TEXT_LANG_KEY, lang)
  }, [lang])

  // Auto-mark on open (set-only; never un-marks) — same semantics as AntiphonView.
  useEffect(() => {
    onMarkViewed(practiceId)
  }, [onMarkViewed, practiceId])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= slides.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [index, slides.length]
  )
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index])
  const goNext = useCallback(() => goTo(index + 1), [goTo, index])

  // Arrow-key navigation (desktop / PWA on laptop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) goNext()
    else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) goPrev()
  }

  const slide = slides[index]
  const activeLang: Lang = slide?.textoLatim && lang === 'la' ? 'la' : 'pt'
  const activeText = slide ? (activeLang === 'la' ? (slide.textoLatim ?? slide.textoPt) : slide.textoPt) : ''
  const toggleLang = () => setLang((l) => (l === 'pt' ? 'la' : 'pt'))
  const completed = isCompleted(practiceId)

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
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading flex items-center justify-center gap-1.5">
              {state.status === 'ready' && (
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${COLOR_DOT_CLASS[state.data.cor]}`}
                  aria-hidden="true"
                />
              )}
              Liturgia do Dia
            </p>
            <h1 className="font-heading text-base font-semibold text-primary dark:text-primary-light truncate mt-0.5">
              {state.status === 'ready' ? state.data.liturgia : state.status === 'error' ? 'Indisponível' : 'Carregando…'}
            </h1>
          </div>
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

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {state.status === 'loading' ? (
          <Spinner className="h-full" />
        ) : state.status === 'error' ? (
          <div className="flex flex-col h-full items-center justify-center gap-4 px-8 text-center">
            <AlertCircle className="w-8 h-8 text-text-muted dark:text-text-muted-dark" />
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Não foi possível carregar a liturgia do dia.
            </p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark transition-transform active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        ) : slides.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center gap-1 px-8 text-center">
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Leituras indisponíveis offline.
            </p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${slide.key}-${activeLang}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 overflow-y-auto touch-pan-y"
              >
                <div className="mx-auto w-full max-w-2xl p-5 pb-20">
                  <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading mb-1">
                    {slide.label}
                  </p>
                  {slide.referencia && (
                    <p className="font-heading text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-0.5">
                      {slide.referencia}
                    </p>
                  )}
                  {slide.titulo && (
                    <p className="text-sm italic text-text-muted dark:text-text-muted-dark mb-3">{slide.titulo}</p>
                  )}
                  {slide.refrao && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-surface-secondary dark:bg-surface-secondary-dark">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted dark:text-text-muted-dark font-heading mb-1">
                        Refrão
                      </p>
                      <MarkdownRenderer markdown={slide.refrao} className="prose-prayer" />
                    </div>
                  )}
                  <MarkdownRenderer markdown={activeText} className="prose-prayer" />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Language toggle — readings/psalm only (propers have no free Novus Ordo Latin) */}
            {slide.textoLatim && (
              <button
                onClick={toggleLang}
                className="absolute bottom-4 right-4 px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
              >
                {lang === 'pt' ? LANG_LABELS.la : LANG_LABELS.pt}
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer: one dot per slide + prev/next */}
      {slides.length > 0 && (
        <footer className="shrink-0 border-t border-border dark:border-border-dark pb-[var(--safe-area-bottom)]">
          <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => goTo(i)}
                  aria-label={`Ir para ${s.label}`}
                  className={`h-2 rounded-full transition-all ${
                    i === index
                      ? 'w-5 bg-primary dark:bg-primary-light'
                      : 'w-2 bg-border dark:bg-border-dark'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={index === slides.length - 1}
              className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Próximo slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </footer>
      )}
    </motion.div>
  )
}
