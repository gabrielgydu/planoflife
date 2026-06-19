import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Shuffle, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import { getToday } from '../../utils/dates'
import rosaryRaw from '../../data/rosary_contemplation.json'

type SetKey = 'gozosos' | 'dolorosos' | 'gloriosos' | 'luminosos'
interface RosaryMystery {
  title: string
  quotes: string[]
}
interface RosarySet {
  label: string
  vocalDays: number[]
  mysteries: RosaryMystery[]
}
interface RosaryData {
  prologo: { title: string; author: string; date: string | null; paragraphs: string[] }
  nonDaySetByWeekday: Record<string, SetKey>
  sets: Record<SetKey, RosarySet>
}
const data = rosaryRaw as unknown as RosaryData

function randomQuote(quotes: string[]): string {
  return quotes[Math.floor(Math.random() * quotes.length)]
}

export function RosaryContemplationView() {
  const navigate = useNavigate()

  const weekday = getToday().getDay() // 0=Sun … 6=Sat
  const setKey = data.nonDaySetByWeekday[String(weekday)]
  const set = data.sets[setKey]

  // One random quote per mystery, re-rolled fresh on every open (mount) and on
  // demand via the shuffle button.
  const [picks, setPicks] = useState<string[]>(() => set.mysteries.map((m) => randomQuote(m.quotes)))
  const [showPrologo, setShowPrologo] = useState(false)

  const reshuffle = () => setPicks(set.mysteries.map((m) => randomQuote(m.quotes)))

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center justify-between px-4 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Contemplação do Rosário
          </h1>
          <button
            onClick={reshuffle}
            className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Trocar citações"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </header>

      <motion.div
        className="flex-1 p-4 space-y-6 mx-auto w-full max-w-2xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div>
          <p className="text-xs text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
            Hoje
          </p>
          <h2 className="font-heading text-xl font-semibold text-primary dark:text-primary-light mt-0.5">
            {set.label}
          </h2>
        </div>

        {/* Prólogo (collapsible) */}
        <div className="bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
          <button
            onClick={() => setShowPrologo((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-sm font-heading font-medium text-text-secondary dark:text-text-secondary-dark"
          >
            <span>Prólogo — São Josemaria</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showPrologo ? 'rotate-180' : ''}`} />
          </button>
          {showPrologo && (
            <div className="px-3 pb-3 space-y-2">
              {data.prologo.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Mysteries — one random contemplation per mystery */}
        <div className="space-y-4">
          {set.mysteries.map((m, i) => (
            <div
              key={m.title}
              className="p-4 bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-lg"
            >
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-heading text-sm font-semibold text-primary dark:text-primary-light">
                  {i + 1}.
                </span>
                <h3 className="font-heading text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                  {m.title}
                </h3>
              </div>
              <p className="text-sm italic text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                {picks[i]}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-text-muted dark:text-text-muted-dark leading-relaxed">
          Citações de «Santo Rosário», de São Josemaria. Uma frase ao acaso por mistério — toque em
          {' '}↻ para trocar.
          {setKey === 'luminosos' &&
            ' Os mistérios luminosos foram acrescentados após o texto original de 1934.'}
        </p>
      </motion.div>
    </div>
  )
}
