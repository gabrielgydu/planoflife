import { useState, useEffect } from 'react'
import { Swords, Check, Pencil, X, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import { useExameParticular, type ExameParticularType } from '../../hooks/useExameParticular'
import { parseDate, getTodayStr } from '../../utils/dates'
import exameRaw from '../../data/exame_particular.json'

interface ExameQuote {
  ref: string
  text: string
}
interface ExamePontoTipo {
  key: ExameParticularType
  label: string
  hint: string
}
interface ExameData {
  summary: string
  distincao: { geral: string; particular: string }
  comoFazer: string[]
  pontoTipos: ExamePontoTipo[]
  notaPositiva: string
  quotes: ExameQuote[]
}
const data = exameRaw as unknown as ExameData

function daysSince(startDate: string): number {
  const diff = parseDate(getTodayStr()).getTime() - parseDate(startDate).getTime()
  return Math.max(0, Math.round(diff / 86_400_000))
}

interface ExameParticularViewProps {
  // The practice id — drives the complete-toggle / streaks (dailyRecord).
  practiceId: string
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * The midday particular-examen reader, opened as a full-screen overlay by tapping
 * the "Exame particular" practice. The single active point (a virtue to grow or a
 * defect to uproot) is a synced setting; the day's completion is the practice's own
 * dailyRecord (so it counts in history like every other practice).
 */
export function ExameParticularView({
  practiceId,
  isCompleted,
  onTogglePractice,
  onClose,
}: ExameParticularViewProps) {
  const { point, setPoint, clearPoint } = useExameParticular()

  const [editing, setEditing] = useState(false)
  const [draftType, setDraftType] = useState<ExameParticularType>(point?.type ?? 'virtude')
  const [draftText, setDraftText] = useState(point?.text ?? '')
  const [showGuide, setShowGuide] = useState(false)

  // Lock background scroll behind the full-screen overlay.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const completed = isCompleted(practiceId)

  const openEditor = () => {
    setDraftType(point?.type ?? 'virtude')
    setDraftText(point?.text ?? '')
    setEditing(true)
  }

  const saveDraft = () => {
    if (!draftText.trim()) return
    setPoint(draftType, draftText)
    setEditing(false)
  }

  const typeLabel = (t: ExameParticularType) =>
    data.pontoTipos.find((p) => p.key === t)?.label ?? t

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark"
    >
      {/* Header */}
      <header className="shrink-0 border-b border-border/30 dark:border-border-dark/30">
        <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark truncate px-2">
            Exame particular
          </h1>

          <motion.button
            onClick={() => onTogglePractice(practiceId)}
            whileTap={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
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
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6 mx-auto w-full max-w-2xl">
          <p className="text-xs text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
            Ao meio-dia
          </p>

          {/* Current point / editor */}
          {editing || !point ? (
            <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg space-y-3">
              <p className="text-xs font-heading font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide">
                {point ? 'Trocar o ponto' : 'Definir o ponto de luta'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {data.pontoTipos.map((pt) => (
                  <button
                    key={pt.key}
                    onClick={() => setDraftType(pt.key)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      draftType === pt.key
                        ? 'bg-btn text-btn-text border-transparent dark:bg-btn-dark dark:text-btn-dark-text'
                        : 'bg-surface-card dark:bg-surface-dark border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                {data.pontoTipos.find((p) => p.key === draftType)?.hint}
              </p>

              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={
                  draftType === 'virtude'
                    ? 'Que virtude queres adquirir?'
                    : 'Que defeito queres arrancar?'
                }
                rows={2}
                className="w-full px-3 py-2 text-sm bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30 resize-none"
                autoFocus
              />

              <div className="flex gap-2">
                <button
                  onClick={saveDraft}
                  disabled={!draftText.trim()}
                  className="px-4 py-2 text-sm font-medium text-btn-text bg-btn rounded-lg dark:bg-btn-dark dark:text-btn-dark-text disabled:opacity-50"
                >
                  Guardar
                </button>
                {point && (
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-2 text-sm text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
              <div className="flex items-start gap-3">
                <Swords className="w-5 h-5 text-primary dark:text-primary-light mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-heading font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">
                    {typeLabel(point.type)}
                  </p>
                  <p className="text-base text-text-primary dark:text-text-primary-dark">{point.text}</p>
                  <p className="text-xs text-text-muted dark:text-text-muted-dark mt-2">
                    Há {daysSince(point.startDate)} {daysSince(point.startDate) === 1 ? 'dia' : 'dias'} neste ponto
                  </p>
                </div>
                <button
                  onClick={openEditor}
                  className="p-1 -mt-1 -mr-1 text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
                  aria-label="Trocar ponto"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => onTogglePractice(practiceId)}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  completed
                    ? 'bg-primary/10 dark:bg-primary-light/10 border-primary/40 dark:border-primary-light/40 text-primary dark:text-primary-light'
                    : 'bg-surface-card dark:bg-surface-dark border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark'
                }`}
              >
                <Check className="w-4 h-4" />
                {completed ? 'Feito hoje' : 'Marcar como feito hoje'}
              </button>
            </div>
          )}

          {/* Summary */}
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
            {data.summary}
          </p>

          {/* Guidance (collapsible) */}
          <div className="border-t border-border dark:border-border-dark pt-4">
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-heading font-medium text-text-secondary dark:text-text-secondary-dark"
            >
              <span>Como fazer & palavras de São Josemaria</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showGuide ? 'rotate-180' : ''}`}
              />
            </button>

            {showGuide && (
              <div className="mt-4 space-y-5">
                <div className="space-y-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                  <p>
                    <span className="font-medium text-text-primary dark:text-text-primary-dark">Exame geral —</span>{' '}
                    {data.distincao.geral}
                  </p>
                  <p>
                    <span className="font-medium text-text-primary dark:text-text-primary-dark">Exame particular —</span>{' '}
                    {data.distincao.particular}
                  </p>
                </div>

                <ol className="space-y-2 text-sm text-text-secondary dark:text-text-secondary-dark list-decimal pl-5">
                  {data.comoFazer.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>

                <p className="text-sm italic text-text-secondary dark:text-text-secondary-dark">
                  {data.notaPositiva}
                </p>

                <div className="space-y-3">
                  {data.quotes.map((q) => (
                    <blockquote
                      key={q.ref}
                      className="border-l-2 border-primary/40 dark:border-primary-light/40 pl-3"
                    >
                      <p className="text-sm italic text-text-primary dark:text-text-primary-dark">{q.text}</p>
                      <cite className="text-xs not-italic text-text-muted dark:text-text-muted-dark">— {q.ref}</cite>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
          </div>

          {point && !editing && (
            <button
              onClick={clearPoint}
              className="text-xs text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
            >
              Concluir este ponto
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
