import { useState } from 'react'
import { Check, Trophy, ScrollText } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCareerPlan, useCareerWins, useCareerLog } from '../../hooks/useCareer'

const LOG_PREVIEW_COUNT = 8

const fmtDay = (date: string) => format(parseISO(date), "d 'de' MMM", { locale: ptBR })

export function RoadmapFeed() {
  const plan = useCareerPlan()
  const wins = useCareerWins()
  const log = useCareerLog()
  const [showAllLog, setShowAllLog] = useState(false)

  const visibleLog = showAllLog ? log : log.slice(0, LOG_PREVIEW_COUNT)

  return (
    <>
      {/* Roadmap: phases timeline */}
      {plan && plan.phases.length > 0 && (
        <section className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
            Roteiro
          </h2>
          <ol className="relative space-y-4">
            {plan.phases.map((phase, i) => {
              const active = phase.status === 'active'
              const done = phase.status === 'done'
              return (
                <li key={phase.name} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                        done
                          ? 'bg-success text-white'
                          : active
                            ? 'bg-btn dark:bg-btn-dark ring-4 ring-primary/10 dark:ring-ring-dark/20'
                            : 'border-2 border-border dark:border-border-dark'
                      }`}
                    >
                      {done && <Check className="w-3 h-3" />}
                    </span>
                    {i < plan.phases.length - 1 && (
                      <span className="w-px flex-1 mt-1 bg-border dark:bg-border-dark" />
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p
                      className={`text-sm ${
                        active
                          ? 'font-semibold text-text-primary dark:text-text-primary-dark'
                          : 'font-medium text-text-secondary dark:text-text-secondary-dark'
                      }`}
                    >
                      {phase.name}
                      <span className="ml-2 text-xs font-normal text-text-muted dark:text-text-muted-dark">
                        {phase.timeframe}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                      {phase.summary}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* Wins feed */}
      <section className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4 space-y-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
          <Trophy className="w-3.5 h-3.5" />
          Wins
        </h2>
        {wins.length === 0 ? (
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            As wins colhidas no sábado aparecem aqui.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {wins.map((w) => (
              <li key={w.id} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 text-xs text-text-muted dark:text-text-muted-dark w-14 pt-0.5">
                  {fmtDay(w.date)}
                </span>
                <span className="text-text-primary dark:text-text-primary-dark">{w.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Session log timeline */}
      {log.length > 0 && (
        <section className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4 space-y-3">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
            <ScrollText className="w-3.5 h-3.5" />
            Diário do plano
          </h2>
          <ul className="space-y-3">
            {visibleLog.map((entry) => (
              <li key={entry.id}>
                <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                  {entry.title}
                  <span className="ml-2 text-xs font-normal text-text-muted dark:text-text-muted-dark">
                    {fmtDay(entry.date)}
                  </span>
                </p>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                  {entry.summary}
                </p>
              </li>
            ))}
          </ul>
          {log.length > LOG_PREVIEW_COUNT && (
            <button
              onClick={() => setShowAllLog((v) => !v)}
              className="text-xs font-medium text-primary dark:text-primary-light"
            >
              {showAllLog ? 'Mostrar menos' : `Mostrar todas (${log.length})`}
            </button>
          )}
        </section>
      )}
    </>
  )
}
