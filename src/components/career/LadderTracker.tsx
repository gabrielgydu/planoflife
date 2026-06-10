import { useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { useCareerLadder, updateRung } from '../../hooks/useCareer'
import type { CareerLadderRung, CareerLadderStatus } from '../../types'

const STATUS_OPTIONS: { key: CareerLadderStatus; label: string }[] = [
  { key: 'pending', label: 'Pendente' },
  { key: 'in-progress', label: 'Em curso' },
  { key: 'done', label: 'Feito' },
]

function RungModal({ rung, onClose }: { rung: CareerLadderRung; onClose: () => void }) {
  const [status, setStatus] = useState<CareerLadderStatus>(rung.status)
  const [notes, setNotes] = useState(rung.notes)

  const save = async () => {
    await updateRung(rung.id, { status, notes: notes.trim() })
    onClose()
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
          {rung.rung}. {rung.title}
        </h3>
        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
          {rung.description}
        </p>
      </div>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatus(opt.key)}
            aria-pressed={status === opt.key}
            className={`flex-1 py-2 px-2 text-sm rounded-lg transition-colors ${
              status === opt.key
                ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
                : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
          Notas
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-sm text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={() => void save()}
          className="flex-1 py-2.5 text-sm font-medium bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text rounded-lg"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

export function LadderTracker() {
  const rungs = useCareerLadder()
  const [open, setOpen] = useState<CareerLadderRung | null>(null)

  if (rungs.length === 0) return null

  // The rung you're standing on: first not-done (sequence is the whole point —
  // "Tier-1 is never the first live interview").
  const currentId = rungs.find((r) => r.status !== 'done')?.id

  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
        Escada de exposição
      </h2>

      <ol className="space-y-1.5">
        {rungs.map((r) => {
          const isCurrent = r.id === currentId
          const done = r.status === 'done'
          return (
            <li key={r.id}>
              <button
                onClick={() => setOpen(r)}
                aria-label={`Degrau ${r.rung}: ${r.title}`}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  isCurrent
                    ? 'bg-primary/5 dark:bg-primary-light/5 ring-1 ring-primary/20 dark:ring-ring-dark/30'
                    : 'hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark'
                }`}
              >
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                    done
                      ? 'bg-success text-white'
                      : isCurrent
                        ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
                        : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-muted dark:text-text-muted-dark'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : r.rung}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${
                      done
                        ? 'text-text-muted dark:text-text-muted-dark line-through'
                        : 'text-text-primary dark:text-text-primary-dark font-medium'
                    }`}
                  >
                    {r.title}
                    {r.status === 'in-progress' && (
                      <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-500">
                        em curso
                      </span>
                    )}
                  </span>
                  {isCurrent && r.notes && (
                    <span className="block text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                      {r.notes}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <Modal isOpen={open !== null} onClose={() => setOpen(null)}>
        {open && <RungModal key={open.id} rung={open} onClose={() => setOpen(null)} />}
      </Modal>
    </section>
  )
}
