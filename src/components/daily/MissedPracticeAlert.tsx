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
    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Ontem você não fez: <strong>{practice.name}</strong>
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por quê?"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              onClick={handleSubmit}
              disabled={!reason.trim() || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? '...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
