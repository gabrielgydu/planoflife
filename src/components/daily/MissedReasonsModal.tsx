import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { useMissedRequiredPractices, useMissedReasons } from '../../hooks/useMissedReasons'
import { useExamenEntries } from '../../hooks/useExamen'
import { useIndividualReasons } from '../../hooks/useSettings'
import { parseDate, formatDateShort } from '../../utils/dates'

interface MissedReasonsModalProps {
  isOpen: boolean
  yesterdayStr: string
  onComplete: () => void
}

interface PracticeState {
  reason: string
  addToExamen: boolean
}

export function MissedReasonsModal({ isOpen, yesterdayStr, onComplete }: MissedReasonsModalProps) {
  const { missedPractices, isLoading } = useMissedRequiredPractices(yesterdayStr)
  const { addReason } = useMissedReasons(yesterdayStr)
  const { addEntry } = useExamenEntries(yesterdayStr)
  const [individualReasons] = useIndividualReasons()

  const [practiceStates, setPracticeStates] = useState<Record<string, PracticeState>>({})
  const [groupedReason, setGroupedReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [autoSkipped, setAutoSkipped] = useState(false)

  // Auto-skip if no missed practices
  useEffect(() => {
    if (!isOpen || isLoading || autoSkipped) return
    if (missedPractices.length === 0) {
      setAutoSkipped(true)
      onComplete()
    }
  }, [isOpen, isLoading, missedPractices.length, onComplete, autoSkipped])

  const getState = useCallback(
    (id: string): PracticeState => practiceStates[id] ?? { reason: '', addToExamen: false },
    [practiceStates]
  )

  const updateState = (id: string, patch: Partial<PracticeState>) => {
    setPracticeStates((prev) => ({
      ...prev,
      [id]: { ...getState(id), ...patch },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    for (const practice of missedPractices) {
      const state = getState(practice.id)
      const reason = individualReasons ? state.reason.trim() : groupedReason.trim()

      if (reason) {
        await addReason(practice.id, reason)
      }

      if (state.addToExamen) {
        const text = reason
          ? `Não fiz: ${practice.name} — ${reason}`
          : `Não fiz: ${practice.name}`
        await addEntry('perdon', text)
      }
    }
    setIsSaving(false)
    onComplete()
  }

  if (!isOpen || isLoading || missedPractices.length === 0) return null

  const formattedDate = formatDateShort(parseDate(yesterdayStr))

  return (
    <Modal isOpen={isOpen}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-[#A89548] dark:text-gray-400 shrink-0" />
          <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Práticas não realizadas
          </h2>
        </div>
        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-4">{formattedDate}</p>

        {individualReasons ? (
          <div className="space-y-4 mb-6">
            {missedPractices.map((practice) => {
              const state = getState(practice.id)
              return (
                <div key={practice.id}>
                  <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    {practice.name}
                  </p>
                  <input
                    type="text"
                    value={state.reason}
                    onChange={(e) => updateState(practice.id, { reason: e.target.value })}
                    placeholder="Por quê?"
                    className="w-full px-3 py-2 text-sm bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
                  />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.addToExamen}
                      onChange={(e) => updateState(practice.id, { addToExamen: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                      Adicionar ao exame
                    </span>
                  </label>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mb-6">
            <ul className="mb-3 space-y-1">
              {missedPractices.map((practice) => (
                <li key={practice.id} className="text-sm text-text-primary dark:text-text-primary-dark flex items-start gap-2">
                  <span className="text-text-muted dark:text-text-muted-dark mt-0.5">•</span>
                  {practice.name}
                </li>
              ))}
            </ul>
            <input
              type="text"
              value={groupedReason}
              onChange={(e) => setGroupedReason(e.target.value)}
              placeholder="Por quê?"
              className="w-full px-3 py-2 text-sm bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30 mb-3"
            />
            <div className="space-y-2">
              {missedPractices.map((practice) => {
                const state = getState(practice.id)
                return (
                  <label key={practice.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.addToExamen}
                      onChange={(e) => updateState(practice.id, { addToExamen: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                      Adicionar "{practice.name}" ao exame
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg hover:bg-border dark:hover:bg-border-dark transition-colors"
          >
            Pular
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-btn-text bg-btn rounded-lg hover:bg-btn-hover dark:bg-btn-dark dark:hover:bg-btn-dark-hover dark:text-btn-dark-text disabled:opacity-50 transition-colors"
          >
            {isSaving ? '...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
