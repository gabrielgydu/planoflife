import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Practice } from '../../types'

interface MissedPracticeAlertProps {
  practice: Practice
  onSaveReason: (reason: string) => void
}

export function MissedPracticeAlert({ practice, onSaveReason }: MissedPracticeAlertProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setIsSubmitting(true)
    await onSaveReason(reason.trim())
    setIsSubmitting(false)
  }

  return (
    <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#A89548] mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
            Ontem você não fez: <strong>{practice.name}</strong>
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por quê?"
              className="flex-1 px-3 py-2 text-sm bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleSubmit}
              disabled={!reason.trim() || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? '...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
