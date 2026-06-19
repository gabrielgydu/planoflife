import { useState } from 'react'
import { Plus, Send } from 'lucide-react'
import { differenceInCalendarDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Modal } from '../shared/Modal'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import {
  useCareerOutreach,
  addOutreach,
  updateOutreach,
  deleteOutreach,
  type OutreachDraft,
} from '../../hooks/useCareer'
import { getTodayStr } from '../../utils/dates'
import type { CareerOutreachAttempt } from '../../types'

// Outreach is treated as an experiment: after ~N attempts or M weeks, review
// the data (response rate, channels) instead of pushing on blindly.
const CHECKPOINT_ATTEMPTS = 20
const CHECKPOINT_WEEKS = 8

const CHANNELS = ['Direct', 'Braintrust', 'Toptal', 'YC/Wellfound', 'Job board', 'Inbound', 'Outro']

const emptyDraft = (): OutreachDraft => ({
  date: getTodayStr(),
  channel: CHANNELS[0],
  target: '',
  rateQuoted: '',
  response: '',
  notes: '',
})

const inputCls =
  'w-full px-3 py-2.5 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-sm text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30'
const labelCls = 'block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1'

function OutreachForm({
  attempt,
  onClose,
}: {
  attempt: CareerOutreachAttempt | null // null = new
  onClose: () => void
}) {
  const [draft, setDraft] = useState<OutreachDraft>(() =>
    attempt
      ? {
          date: attempt.date,
          channel: attempt.channel,
          target: attempt.target,
          rateQuoted: attempt.rateQuoted,
          response: attempt.response,
          notes: attempt.notes,
        }
      : emptyDraft()
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch: Partial<OutreachDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const valid = draft.date && draft.channel && draft.target.trim()

  const save = async () => {
    if (!valid) return
    const clean = { ...draft, target: draft.target.trim() }
    if (attempt) await updateOutreach(attempt.id, clean)
    else await addOutreach(clean)
    onClose()
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
        {attempt ? 'Editar tentativa' : 'Nova tentativa'}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Data</label>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Canal</label>
          <select
            value={draft.channel}
            onChange={(e) => set({ channel: e.target.value })}
            className={inputCls}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Alvo (empresa / pessoa)</label>
        <input
          type="text"
          value={draft.target}
          onChange={(e) => set({ target: e.target.value })}
          placeholder="ex.: empresa — eng lead"
          className={inputCls}
          autoFocus={!attempt}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Taxa proposta</label>
          <input
            type="text"
            value={draft.rateQuoted}
            onChange={(e) => set({ rateQuoted: e.target.value })}
            placeholder="ex.: $100/h"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Resposta</label>
          <input
            type="text"
            value={draft.response}
            onChange={(e) => set({ response: e.target.value })}
            placeholder="ex.: sem resposta"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas</label>
        <textarea
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          className={inputCls}
        />
      </div>

      <div className="flex gap-2 pt-1">
        {attempt && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2.5 text-sm font-medium text-[#9B6B6B] bg-[#9B6B6B]/10 rounded-lg hover:bg-[#9B6B6B]/20 transition-colors"
          >
            Excluir
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={() => void save()}
          disabled={!valid}
          className="flex-1 py-2.5 text-sm font-medium bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text rounded-lg disabled:opacity-50"
        >
          Salvar
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Excluir tentativa"
        message="Remover esta tentativa de outreach?"
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => {
          if (attempt) void deleteOutreach(attempt.id)
          setConfirmDelete(false)
          onClose()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

export function OutreachTracker() {
  const attempts = useCareerOutreach()
  const [editing, setEditing] = useState<CareerOutreachAttempt | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const firstDate = attempts.length
    ? attempts.reduce((min, a) => (a.date < min ? a.date : min), attempts[0].date)
    : null
  // Elapsed weeks since the first attempt (week 1 = days 0–6), not calendar-week
  // boundary crossings — those would fire the "8 weeks" tripwire 1–2 weeks early.
  // Clamped to ≥1 so a future-dated attempt can't show "semana -5".
  const daysElapsed = firstDate ? differenceInCalendarDays(new Date(), parseISO(firstDate)) : 0
  const weeks = firstDate ? Math.max(1, Math.floor(daysElapsed / 7) + 1) : 0
  const checkpointHit =
    attempts.length >= CHECKPOINT_ATTEMPTS || daysElapsed >= CHECKPOINT_WEEKS * 7
  const progress = Math.min(100, Math.round((attempts.length / CHECKPOINT_ATTEMPTS) * 100))

  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
          Outreach
        </h2>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar
        </button>
      </div>

      {/* Checkpoint progress: ~20 attempts or 8 weeks, whichever first */}
      <div>
        <div className="flex justify-between text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
          <span>
            {attempts.length}/{CHECKPOINT_ATTEMPTS} tentativas
          </span>
          {firstDate && (
            <span>
              semana {Math.min(weeks, CHECKPOINT_WEEKS)}/{CHECKPOINT_WEEKS}
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-surface-secondary dark:bg-surface-secondary-dark overflow-hidden">
          <div
            className="h-full rounded-full bg-btn dark:bg-btn-dark transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        {checkpointHit && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">
            Checkpoint atingido — revisar canais e taxa no review mensal.
          </p>
        )}
      </div>

      {attempts.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-text-muted dark:text-text-muted-dark py-2">
          <Send className="w-4 h-4" />
          Nenhuma tentativa registrada ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border dark:divide-border-dark">
          {attempts.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => {
                  setEditing(a)
                  setFormOpen(true)
                }}
                className="w-full py-2.5 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark flex-1 min-w-0 truncate">
                    {a.target}
                  </span>
                  <span className="text-xs text-text-muted dark:text-text-muted-dark whitespace-nowrap">
                    {format(parseISO(a.date), "d 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary dark:text-text-secondary-dark">
                  <span className="px-1.5 py-0.5 rounded bg-surface-secondary dark:bg-surface-secondary-dark">
                    {a.channel}
                  </span>
                  {a.rateQuoted && <span>{a.rateQuoted}</span>}
                  {a.response && <span className="truncate">→ {a.response}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)}>
        {formOpen && <OutreachForm attempt={editing} onClose={() => setFormOpen(false)} />}
      </Modal>
    </section>
  )
}
