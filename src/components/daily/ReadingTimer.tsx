import { Play, Pause, RotateCcw, Check } from 'lucide-react'
import { useReadingTimer } from '../../hooks/useReadingTimer'

interface ReadingTimerProps {
  storageKey: string
  dateStr: string
  durationMs: number
  onFinish: () => void
}

// Rounded UP, like a kitchen timer: the full duration shows until a whole second has
// gone, and 0:00 only once it is over.
function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Start/pause pill for a day's reading countdown. Its own component so the running
 * tick re-renders only this pill, never the reader's text around it. Key it by the
 * date: a different day is a different timer.
 */
export function ReadingTimer({ storageKey, dateStr, durationMs, onFinish }: ReadingTimerProps) {
  const { remainingMs, running, started, finished, start, pause, reset } = useReadingTimer(
    storageKey,
    dateStr,
    durationMs,
    onFinish
  )
  const minutes = Math.round(durationMs / 60000)

  return (
    <div className="flex rounded-full overflow-hidden shadow-lg bg-surface-secondary dark:bg-surface-secondary-dark">
      {finished ? (
        <span
          role="status"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary dark:text-primary-light"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
          {minutes} min
        </span>
      ) : (
        <button
          onClick={running ? pause : start}
          aria-pressed={running}
          aria-label={
            running
              ? `Pausar cronômetro (${formatClock(remainingMs)} restantes)`
              : started
                ? `Continuar cronômetro (${formatClock(remainingMs)} restantes)`
                : `Iniciar cronômetro de ${minutes} minutos`
          }
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium tabular-nums transition-colors ${
            running
              ? 'bg-primary text-white dark:bg-primary-light dark:text-surface-dark'
              : 'text-text-secondary dark:text-text-secondary-dark hover:bg-border/50 dark:hover:bg-border-dark/50'
          }`}
        >
          {running ? (
            <Pause className="w-3.5 h-3.5" fill="currentColor" />
          ) : (
            <Play className="w-3.5 h-3.5" fill="currentColor" />
          )}
          {formatClock(remainingMs)}
        </button>
      )}
      {started && !running && (
        <button
          onClick={reset}
          aria-label="Zerar cronômetro"
          className="px-2.5 py-2 border-l border-border/60 dark:border-border-dark/60 text-text-muted dark:text-text-muted-dark hover:bg-border/50 dark:hover:bg-border-dark/50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
