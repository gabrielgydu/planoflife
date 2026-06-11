import { Fragment } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCareerPlan } from '../../hooks/useCareer'
import type { CareerMilestone } from '../../types'

/**
 * "Anos como âncoras" — the years-scale view of the career plan: every year
 * from the first milestone to the last walks down a single spine; years with
 * milestones get an oversized ghost numeral, empty years compress to a tick.
 * The spine is filled (green) up to a pulsing "hoje" marker, so the card reads
 * as progress through time, not just a list. Tentative milestones (the US
 * option — a lean, not a decision) render dashed with an "opção" tag.
 *
 * Content (labels/details) arrives in EN via the publish bridge; chrome stays
 * PT like the rest of the app.
 */

type Row =
  | { kind: 'year'; key: string; year: number; hasMilestones: boolean }
  | { kind: 'milestone'; key: string; ms: CareerMilestone }
  | { kind: 'now'; key: string }

const fmtMonth = (yyyyMm: string) => format(parseISO(`${yyyyMm}-01`), 'MMM yyyy', { locale: ptBR })

function buildRows(milestones: CareerMilestone[], nowKey: string): Row[] {
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))
  const firstYear = Number(sorted[0].date.slice(0, 4))
  const lastYear = Number(sorted[sorted.length - 1].date.slice(0, 4))
  const milestoneYears = new Set(sorted.map((m) => Number(m.date.slice(0, 4))))

  const rows: Row[] = []
  for (let y = firstYear; y <= lastYear; y++) {
    // 'YYYY-00' sorts before any 'YYYY-MM', so the year chip heads its block
    rows.push({ kind: 'year', key: `${y}-00`, year: y, hasMilestones: milestoneYears.has(y) })
  }
  for (const ms of sorted) {
    rows.push({ kind: 'milestone', key: ms.date, ms })
  }
  // '-15' places "hoje" after a same-month milestone but before the next one
  rows.push({ kind: 'now', key: `${nowKey}-15` })
  rows.sort((a, b) => a.key.localeCompare(b.key))
  return rows
}

function Node({ ms }: { ms: CareerMilestone }) {
  if (ms.status === 'done') {
    return (
      <span className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center">
        <Check className="w-3 h-3" />
      </span>
    )
  }
  if (ms.status === 'active') {
    return (
      <span className="w-5 h-5 rounded-full bg-btn dark:bg-btn-dark ring-4 ring-primary/10 dark:ring-ring-dark/20" />
    )
  }
  return (
    <span
      className={`w-5 h-5 rounded-full border-2 bg-surface-card dark:bg-surface-card-dark ${
        ms.tentative
          ? 'border-dashed border-text-muted dark:border-text-muted-dark'
          : 'border-border dark:border-border-dark'
      }`}
    />
  )
}

export function YearTimeline() {
  const plan = useCareerPlan()
  const milestones = plan?.milestones ?? []
  if (milestones.length === 0) return null

  const nowKey = format(new Date(), 'yyyy-MM')
  const rows = buildRows(milestones, nowKey)
  const firstYear = rows[0].kind === 'year' ? rows[0].year : ''
  const lastYear = milestones.map((m) => m.date.slice(0, 4)).sort().at(-1)

  return (
    <section className="relative overflow-hidden bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
          Linha do tempo
        </h2>
        <span className="font-heading text-xs font-semibold tabular-nums text-text-muted dark:text-text-muted-dark">
          {firstYear} → {lastYear}
        </span>
      </div>

      <ol className="mt-3">
        {rows.map((row, i) => {
          // the connector below a row is "walked" (green) while it still leads to hoje
          const walked = row.key < `${nowKey}-15`
          const last = i === rows.length - 1
          const connector = last ? null : (
            <span
              className={`w-px flex-1 min-h-2 ${
                walked ? 'bg-success/60' : 'bg-border dark:bg-border-dark'
              }`}
            />
          )

          if (row.kind === 'year') {
            return (
              <Fragment key={row.key}>
                {row.hasMilestones && (
                  <span
                    aria-hidden
                    className="absolute right-1 -mt-3 font-heading text-[64px] font-bold leading-none tracking-tighter select-none pointer-events-none text-text-primary/[0.045] dark:text-text-primary-dark/[0.06]"
                  >
                    {row.year}
                  </span>
                )}
                <motion.li
                  className={`flex gap-3 ${row.hasMilestones ? '' : 'opacity-70'}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.045 }}
                >
                  <div className="w-12 flex-shrink-0 flex flex-col items-center">
                    <span
                      className={`font-heading tabular-nums rounded-md border text-center ${
                        row.hasMilestones
                          ? 'text-[11px] font-bold px-1.5 py-0.5 border-border dark:border-border-dark bg-surface-secondary dark:bg-surface-secondary-dark text-text-primary dark:text-text-primary-dark'
                          : 'text-[9px] font-medium px-1 py-px border-transparent text-text-muted dark:text-text-muted-dark'
                      }`}
                    >
                      {row.year}
                    </span>
                    {connector}
                  </div>
                  <div className={row.hasMilestones ? 'pb-2' : 'pb-1'} />
                </motion.li>
              </Fragment>
            )
          }

          if (row.kind === 'now') {
            return (
              <motion.li
                key={row.key}
                className="flex gap-3 items-stretch"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.045 }}
              >
                <div className="w-12 flex-shrink-0 flex flex-col items-center">
                  <span className="relative flex w-3 h-3 my-1">
                    <motion.span
                      className="absolute inline-flex w-full h-full rounded-full bg-success"
                      animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <span className="relative inline-flex w-3 h-3 rounded-full bg-success" />
                  </span>
                  {connector}
                </div>
                <div className="flex items-center gap-2 pb-3 min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-success">
                    hoje
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-success/40 to-transparent" />
                </div>
              </motion.li>
            )
          }

          const { ms } = row
          const done = ms.status === 'done'
          return (
            <motion.li
              key={row.key}
              className="flex gap-3"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.045 }}
            >
              <div className="w-12 flex-shrink-0 flex flex-col items-center">
                <Node ms={ms} />
                {connector}
              </div>
              <div className="min-w-0 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider tabular-nums text-text-muted dark:text-text-muted-dark">
                  {fmtMonth(ms.date)}
                </p>
                <p
                  className={`text-sm mt-0.5 ${
                    done
                      ? 'text-text-secondary dark:text-text-secondary-dark'
                      : ms.status === 'active'
                        ? 'font-semibold text-text-primary dark:text-text-primary-dark'
                        : 'font-medium text-text-primary dark:text-text-primary-dark'
                  }`}
                >
                  {ms.label}
                  {ms.tentative && (
                    <span className="ml-2 align-middle inline-block text-[9px] font-semibold uppercase tracking-widest px-1.5 py-px rounded-full border border-dashed border-text-muted dark:border-text-muted-dark text-text-muted dark:text-text-muted-dark">
                      opção
                    </span>
                  )}
                </p>
                {ms.detail && (
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                    {ms.detail}
                  </p>
                )}
              </div>
            </motion.li>
          )
        })}
      </ol>
    </section>
  )
}
