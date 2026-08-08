import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateLong, relativeDayLabel } from '../../utils/dates'

interface HeaderProps {
  date: Date
  onPrevDay: () => void
  onNextDay: () => void
  /** Tap the date to jump straight back to today. Omitted → the date is plain text. */
  onToday?: () => void
  title?: string
  rightAction?: React.ReactNode
}

/**
 * The day header: back a day, the day itself, forward a day.
 *
 * Both chevrons are always present. `rightAction` sits BESIDE the forward
 * chevron rather than in place of it — it used to replace it, which quietly
 * removed forward navigation from any view that passed one (the daily view did,
 * as soon as a single practice was checked).
 */
export function Header({ date, onPrevDay, onNextDay, onToday, title, rightAction }: HeaderProps) {
  const dateStr = formatDateLong(date)
  const relative = relativeDayLabel(date)
  // The relative marker is set a size down: it is a secondary signal, and at the
  // date's own size the longest days ("quarta-feira, 30 de setembro") plus a
  // marker overflow the header on a narrow phone.
  const dateLabel = (
    <>
      {dateStr}
      {relative && (
        <span className="ml-1.5 text-xs text-primary dark:text-primary-light">{relative}</span>
      )}
    </>
  )
  // Portuguese long dates are wide ("segunda-feira, 30 de novembro"). At 16px the
  // longest of them plus a relative marker overflow a ≤375px header, so the very
  // narrow phones drop a step; 380px and up keep full size. `truncate` remains the
  // backstop for the user's largest UI-font setting.
  const dateClass =
    'font-heading text-sm min-[380px]:text-base font-medium text-text-primary dark:text-text-primary-dark capitalize truncate'

  return (
    <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
      <div className="flex items-center justify-between gap-1 px-4 h-16 mx-auto w-full max-w-2xl">
        <button
          onClick={onPrevDay}
          className="shrink-0 p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0 text-center">
          {title ? (
            <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark truncate">
              {title}
            </h1>
          ) : onToday && relative !== 'Hoje' ? (
            // Away from today, the date doubles as the way back — otherwise
            // returning means tapping a chevron once per day travelled.
            <button
              onClick={onToday}
              className="max-w-full min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
              aria-label="Voltar para hoje"
            >
              <h1 className={dateClass}>{dateLabel}</h1>
            </button>
          ) : (
            <h1 className={dateClass}>{dateLabel}</h1>
          )}
        </div>

        <div className="flex items-center gap-1 -mr-2 shrink-0">
          {rightAction}
          <button
            onClick={onNextDay}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
            aria-label="Próximo dia"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
