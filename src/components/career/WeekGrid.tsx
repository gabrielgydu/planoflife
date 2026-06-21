import { Check, CalendarRange, Repeat } from 'lucide-react'
import {
  setISOWeek,
  startOfISOWeek,
  endOfISOWeek,
  isWithinInterval,
  isBefore,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCareerMoves, setMoveStatus } from '../../hooks/useCareer'
import type { CareerMove } from '../../types'

/**
 * Visual Kalenderwochen grid. The pipeline (careerMoves) carries no week field —
 * the KW is encoded in the title prefix the publish writes ("KW26 · …", "KW27–28 · …",
 * "KW30+ · …", and the recurring "Toda semana · …" engine move). We parse it here so
 * the calendar needs no schema/sync change. Each move still renders exactly once and
 * stays checkable (the e2e migration test toggles moves by their "Concluir <title>"
 * button), except the engine move, which is recurring and shown as a footer reminder.
 *
 * The point is calm: the current/next week is emphasised, past weeks dim, everything
 * else is visibly "later" — so it stops feeling like everything is urgent at once.
 */

interface WeekRef {
  kw: number
  spanTo?: number
  isPlus: boolean
}

function parseWeek(title: string): WeekRef | null {
  const m = title.match(/^KW\s?(\d+)(?:[–-](\d+))?(\+)?/i)
  if (!m) return null
  return { kw: parseInt(m[1], 10), spanTo: m[2] ? parseInt(m[2], 10) : undefined, isPlus: !!m[3] }
}

const isEngine = (m: CareerMove) => /^\s*Toda semana/i.test(m.title)

/** Drop the "KW26 · " / "Toda semana · " label — the card header already carries it. */
function stripPrefix(title: string): string {
  return title.replace(/^\s*(?:KW\s?\d+(?:[–-]\d+)?\+?|Toda semana)\s*·\s*/i, '').trim()
}

// Cosmetic week themes (presentational only — update if the KW buckets shift).
const WEEK_THEME: Record<number, string> = {
  26: 'Encerrar a aerops',
  27: 'Ser encontrável',
  28: 'Plataformas + alvos',
  29: 'Semana do corte',
  30: 'Camada lenta (pós-corte)',
}

function fmtRange(start: Date, end: Date, openEnded: boolean): string {
  if (openEnded) return `${format(start, "d 'de' MMM", { locale: ptBR })} →`
  const sameMonth = start.getMonth() === end.getMonth()
  return sameMonth
    ? `${format(start, 'd')}–${format(end, "d 'de' MMM", { locale: ptBR })}`
    : `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM", { locale: ptBR })}`
}

function MoveCheck({ move }: { move: CareerMove }) {
  const done = move.status === 'done'
  const w = parseWeek(move.title)
  return (
    <div className="flex items-start gap-2.5">
      <button
        onClick={() => void setMoveStatus(move.id, !done)}
        aria-label={done ? `Desmarcar ${move.title}` : `Concluir ${move.title}`}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light ${
          done
            ? 'bg-success border-success text-white'
            : 'border-border dark:border-border-dark hover:border-text-muted'
        }`}
      >
        {done && <Check className="w-3 h-3" />}
      </button>
      <p
        className={`text-sm leading-snug ${
          done
            ? 'line-through text-text-muted dark:text-text-muted-dark'
            : 'text-text-primary dark:text-text-primary-dark'
        }`}
      >
        {stripPrefix(move.title)}
        {w?.spanTo && (
          <span className="ml-1.5 text-xs text-text-muted dark:text-text-muted-dark">→ KW{w.spanTo}</span>
        )}
      </p>
    </div>
  )
}

export function WeekGrid() {
  const moves = useCareerMoves()
  if (moves.length === 0) return null

  const engine = moves.filter(isEngine)
  const scheduled = moves.filter((m) => !isEngine(m) && parseWeek(m.title))
  const unscheduled = moves.filter((m) => !isEngine(m) && !parseWeek(m.title))

  // Group scheduled moves by KW (sortOrder order is preserved from the hook).
  const byWeek = new Map<number, { kw: number; isPlus: boolean; moves: CareerMove[] }>()
  for (const m of scheduled) {
    const w = parseWeek(m.title)!
    const g = byWeek.get(w.kw) ?? { kw: w.kw, isPlus: w.isPlus, moves: [] }
    g.isPlus = g.isPlus || w.isPlus
    g.moves.push(m)
    byWeek.set(w.kw, g)
  }

  const today = new Date()
  const cards = [...byWeek.values()]
    .sort((a, b) => a.kw - b.kw)
    .map((w) => {
      const ref = setISOWeek(today, w.kw)
      const start = startOfISOWeek(ref)
      const end = endOfISOWeek(ref)
      const isCurrent = !w.isPlus && isWithinInterval(today, { start, end })
      const isPast = !w.isPlus && isBefore(end, today)
      return { ...w, start, end, isCurrent, isPast }
    })

  const anyCurrent = cards.some((c) => c.isCurrent)
  const focusKw = anyCurrent ? null : (cards.find((c) => !c.isPast)?.kw ?? null)

  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
        <CalendarRange className="w-3.5 h-3.5" />
        Plano por semana
      </h2>

      {cards.map((c) => {
        const focus = c.isCurrent || c.kw === focusKw
        const doneCount = c.moves.filter((m) => m.status === 'done').length
        const theme = WEEK_THEME[c.kw]
        return (
          <div
            key={c.kw}
            className={`rounded-xl border p-3 transition-colors ${
              focus
                ? 'border-primary/40 dark:border-primary-light/40 bg-primary/5 dark:bg-primary-light/5'
                : c.isPast
                  ? 'border-border/60 dark:border-border-dark/60 bg-surface-card dark:bg-surface-card-dark opacity-60'
                  : 'border-border dark:border-border-dark bg-surface-card dark:bg-surface-card-dark'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <span
                className={`flex-shrink-0 inline-flex flex-col items-center justify-center rounded-lg px-2.5 py-1 leading-none ${
                  focus
                    ? 'bg-primary text-white dark:bg-primary-light dark:text-surface-card-dark'
                    : 'bg-primary/10 dark:bg-primary-light/10 text-primary dark:text-primary-light'
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">KW</span>
                <span className="text-base font-bold">
                  {c.kw}
                  {c.isPlus && '+'}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                    {fmtRange(c.start, c.end, c.isPlus)}
                  </span>
                  {c.isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-white dark:bg-primary-light dark:text-surface-card-dark">
                      Esta semana
                    </span>
                  )}
                  {!c.isCurrent && focus && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 dark:bg-primary-light/15 text-primary dark:text-primary-light">
                      Próxima
                    </span>
                  )}
                </div>
                {theme && (
                  <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5 truncate">{theme}</p>
                )}
              </div>
              <span className="flex-shrink-0 text-xs tabular-nums text-text-muted dark:text-text-muted-dark">
                {doneCount}/{c.moves.length}
              </span>
            </div>
            <div className="space-y-1.5 pl-0.5">
              {c.moves.map((m) => (
                <MoveCheck key={m.id} move={m} />
              ))}
            </div>
          </div>
        )
      })}

      {unscheduled.length > 0 && (
        <div className="rounded-xl border border-border dark:border-border-dark bg-surface-card dark:bg-surface-card-dark p-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark mb-2">
            Sem semana
          </h3>
          <div className="space-y-1.5">
            {unscheduled.map((m) => (
              <MoveCheck key={m.id} move={m} />
            ))}
          </div>
        </div>
      )}

      {engine.map((m) => (
        <div
          key={m.id}
          className="rounded-xl border border-dashed border-border dark:border-border-dark p-3"
        >
          <div className="flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />
            <span className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
              {stripPrefix(m.title) || 'Toda semana'}
            </span>
          </div>
          {m.detail && (
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1.5">{m.detail}</p>
          )}
        </div>
      ))}
    </section>
  )
}
