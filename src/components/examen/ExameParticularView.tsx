import { useState, useEffect } from 'react'
import { Swords, Check, Pencil, X, ChevronDown, Quote } from 'lucide-react'
import { motion } from 'motion/react'
import { useExameTema, type ExameTemaDraft } from '../../hooks/useExameTema'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { parseDate, getTodayStr, formatDateShort } from '../../utils/dates'
import type { ExameTema } from '../../types'

function daysSince(startDate: string): number {
  const diff = parseDate(getTodayStr()).getTime() - parseDate(startDate).getTime()
  return Math.max(0, Math.round(diff / 86_400_000))
}

// Both directors put the ceiling at a month — past it "a luta fica aguada".
const STALE_AFTER_DAYS = 31

// 'edit' loads a tema into the form; 'new' composes the next one. Explicit state
// (not derived from !activeTema) so a synced tema arriving from the other device
// can't unmount the form mid-typing — and 'edit' carries a SNAPSHOT of the tema,
// so a remote conclude of the row being edited can't remount the form either. The
// snapshot's id is also what the save targets (see useExameTema.saveTema).
type EditorState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; tema: ExameTema }

interface TemaEditorProps {
  initial: ExameTema | null // null = composing a new tema
  onSave: (draft: ExameTemaDraft) => void
  onCancel?: () => void // absent when there is nothing to fall back to
}

// Own component so its draft state is born from `initial` on mount and dies on
// unmount — the parent keys it by tema id, which is what guarantees a concluded
// tema's text can never linger into the "Novo tema" form.
function TemaEditor({ initial, onSave, onCancel }: TemaEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [pontos, setPontos] = useState(initial?.pontos.join('\n') ?? '')
  const [guidance, setGuidance] = useState(initial?.guidance ?? '')

  const save = () => {
    if (!title.trim()) return
    onSave({ title, pontos: pontos.split('\n'), guidance })
  }

  return (
    <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg space-y-3">
      <p className="text-xs font-heading font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide">
        {initial ? 'Editar o tema' : 'Novo tema de luta'}
      </p>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tema (ex.: tratar mais o Anjo da Guarda)"
        className="w-full px-3 py-2 text-sm bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
        autoFocus
      />

      <textarea
        value={pontos}
        onChange={(e) => setPontos(e.target.value)}
        placeholder="Pontos concretos, um por linha"
        rows={4}
        className="w-full px-3 py-2 text-sm bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30 resize-none"
      />

      <textarea
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        placeholder="Orientações recebidas (direção espiritual, confissão…)"
        rows={2}
        className="w-full px-3 py-2 text-sm bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30 resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!title.trim()}
          className="px-4 py-2 text-sm font-medium text-btn-text bg-btn rounded-lg dark:bg-btn-dark dark:text-btn-dark-text disabled:opacity-50"
        >
          Salvar
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

interface ExameParticularViewProps {
  // The practice id — drives the complete-toggle / streaks (dailyRecord).
  practiceId: string
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * The midday particular-examen overlay, opened by tapping the "Exame particular"
 * practice. Shows the active tema with its pontos concretos — material to fight on
 * through the day, examined again at night alongside the guiding questions (see
 * GuidingQuestionsList) — plus any guidance received about it. Concluding a tema
 * archives it (Temas anteriores); the day's completion is the practice's own
 * dailyRecord, so it counts in history like every other practice.
 */
export function ExameParticularView({
  practiceId,
  isCompleted,
  onTogglePractice,
  onClose,
}: ExameParticularViewProps) {
  const { activeTema, pastTemas, isLoading, saveTema, concludeTema } = useExameTema()

  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [confirmConclude, setConfirmConclude] = useState(false)
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null)

  // No active tema (first use, or just concluded) → open the composer. Only from
  // 'closed', so an already-open form is left alone.
  useEffect(() => {
    if (!isLoading && !activeTema)
      setEditor((e) => (e.mode === 'closed' ? { mode: 'new' } : e))
  }, [isLoading, activeTema])

  // Lock background scroll behind the full-screen overlay.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const completed = isCompleted(practiceId)

  const handleSave = async (draft: ExameTemaDraft) => {
    await saveTema(draft, editor.mode === 'edit' ? editor.tema.id : null)
    setEditor({ mode: 'closed' })
  }

  const days = activeTema ? daysSince(activeTema.startDate) : 0
  const stale = days > STALE_AFTER_DAYS

  const pastRange = (t: ExameTema & { endedAt: string }) =>
    `${formatDateShort(parseDate(t.startDate))} – ${formatDateShort(parseDate(t.endedAt))}`

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

          {/* Active tema / editor */}
          {isLoading ? null : editor.mode !== 'closed' ? (
            <TemaEditor
              key={editor.mode === 'edit' ? editor.tema.id : 'new'}
              initial={editor.mode === 'edit' ? editor.tema : null}
              onSave={handleSave}
              onCancel={
                editor.mode === 'edit' || activeTema
                  ? () => setEditor({ mode: 'closed' })
                  : undefined
              }
            />
          ) : activeTema ? (
            <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
              <div className="flex items-start gap-3">
                <Swords className="w-5 h-5 text-primary dark:text-primary-light mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-text-primary dark:text-text-primary-dark">
                    {activeTema.title}
                  </p>

                  {activeTema.pontos.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {activeTema.pontos.map((ponto, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-text-secondary dark:text-text-secondary-dark"
                        >
                          <span className="mt-[7px] w-1 h-1 rounded-full bg-primary/60 dark:bg-primary-light/60 shrink-0" />
                          {ponto}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p
                    className={`text-xs mt-3 ${
                      stale
                        ? 'text-[#A89548]'
                        : 'text-text-muted dark:text-text-muted-dark'
                    }`}
                  >
                    Há {days} {days === 1 ? 'dia' : 'dias'} neste tema
                    {stale ? ' — mais de um mês' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setEditor({ mode: 'edit', tema: activeTema })}
                  className="p-1 -mt-1 -mr-1 text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
                  aria-label="Editar tema"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {activeTema.guidance && (
                <div className="mt-4 flex items-start gap-2 border-l-2 border-primary/40 dark:border-primary-light/40 pl-3">
                  <Quote className="w-3.5 h-3.5 mt-0.5 text-text-muted dark:text-text-muted-dark shrink-0" />
                  <p className="text-sm italic text-text-secondary dark:text-text-secondary-dark whitespace-pre-line">
                    {activeTema.guidance}
                  </p>
                </div>
              )}

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
          ) : null}

          {activeTema && editor.mode === 'closed' && (
            <button
              onClick={() => setConfirmConclude(true)}
              className="text-xs text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
            >
              Concluir este tema
            </button>
          )}

          {/* Concluded temas */}
          {pastTemas.length > 0 && (
            <div className="border-t border-border dark:border-border-dark pt-4">
              <p className="text-xs font-heading font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide mb-2">
                Temas anteriores
              </p>
              <div className="divide-y divide-border/30 dark:divide-border-dark/30">
                {pastTemas.map((t) => (
                  <div key={t.id} className="py-2.5">
                    <button
                      onClick={() =>
                        setExpandedPastId((cur) => (cur === t.id ? null : t.id))
                      }
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-text-primary dark:text-text-primary-dark truncate">
                          {t.title}
                        </span>
                        <span className="block text-xs text-text-muted dark:text-text-muted-dark">
                          {pastRange(t)}
                        </span>
                      </span>
                      {(t.pontos.length > 0 || t.guidance) && (
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 text-text-muted dark:text-text-muted-dark transition-transform ${
                            expandedPastId === t.id ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </button>

                    {expandedPastId === t.id && (
                      <div className="mt-2 pl-1 space-y-2">
                        {t.pontos.length > 0 && (
                          <ul className="space-y-1">
                            {t.pontos.map((ponto, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm text-text-secondary dark:text-text-secondary-dark"
                              >
                                <span className="mt-[7px] w-1 h-1 rounded-full bg-text-muted/60 shrink-0" />
                                {ponto}
                              </li>
                            ))}
                          </ul>
                        )}
                        {t.guidance && (
                          <p className="text-sm italic text-text-secondary dark:text-text-secondary-dark border-l-2 border-border dark:border-border-dark pl-3 whitespace-pre-line">
                            {t.guidance}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConclude}
        title="Concluir tema"
        message="Concluir este tema de luta? Ele passa para os temas anteriores."
        confirmLabel="Concluir"
        onConfirm={() => {
          concludeTema()
          setConfirmConclude(false)
        }}
        onCancel={() => setConfirmConclude(false)}
      />
    </motion.div>
  )
}
