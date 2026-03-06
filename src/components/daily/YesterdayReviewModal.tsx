import { useState, useCallback } from 'react'
import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '../shared/Modal'
import { useYesterdayUncompleted } from '../../hooks/useYesterdayUncompleted'
import { useDailyRecords } from '../../hooks/useDailyRecords'
import { parseDate, formatDateShort } from '../../utils/dates'

interface YesterdayReviewModalProps {
  isOpen: boolean
  yesterdayStr: string
  onComplete: () => void
}

export function YesterdayReviewModal({ isOpen, yesterdayStr, onComplete }: YesterdayReviewModalProps) {
  const { uncompleted, isLoading } = useYesterdayUncompleted(yesterdayStr)
  const { togglePractice } = useDailyRecords(yesterdayStr)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSave = async () => {
    if (checkedIds.size === 0) {
      onComplete()
      return
    }
    setIsSaving(true)
    for (const id of checkedIds) {
      await togglePractice(id)
    }
    setIsSaving(false)
    onComplete()
  }

  if (!isOpen || isLoading) return null

  const formattedDate = formatDateShort(parseDate(yesterdayStr))

  if (uncompleted.length === 0) {
    return (
      <Modal isOpen={isOpen}>
        <div className="p-6">
          <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-1">
            Revisão de ontem
          </h2>
          <p className="text-xs text-text-muted dark:text-text-muted-dark mb-4">{formattedDate}</p>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-6">
            Tudo feito ontem!
          </p>
          <button
            onClick={onComplete}
            className="w-full py-2.5 px-4 text-sm font-medium text-btn-text bg-btn rounded-lg hover:bg-btn-hover dark:bg-btn-dark dark:text-btn-dark-text transition-colors"
          >
            Continuar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen}>
      <div className="p-6">
        <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-1">
          Revisão de ontem
        </h2>
        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-4">{formattedDate}</p>

        <div className="space-y-1 mb-6">
          {uncompleted.map((practice) => {
            const isChecked = checkedIds.has(practice.id)
            return (
              <button
                key={practice.id}
                onClick={() => toggleChecked(practice.id)}
                className="flex items-center gap-3 w-full py-3 px-1 text-left"
              >
                <motion.div
                  whileTap={{ scale: 1.15 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isChecked
                      ? 'bg-btn border-[1.5px] border-btn dark:bg-btn-dark dark:border-btn-dark'
                      : 'border-[1.5px] border-border dark:border-border-dark'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 text-btn-text dark:text-btn-dark-text" strokeWidth={3} />}
                </motion.div>
                <span className="text-sm text-text-primary dark:text-text-primary-dark">
                  {practice.name}
                  {practice.isRequired && (
                    <span className="ml-1 text-xs text-[#A89548]">*</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

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
            className="flex-1 py-2.5 px-4 text-sm font-medium text-btn-text bg-btn rounded-lg hover:bg-btn-hover dark:bg-btn-dark dark:text-btn-dark-text disabled:opacity-50 transition-colors"
          >
            {isSaving ? '...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
