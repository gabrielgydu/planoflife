import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate, Link } from 'react-router'
import { ChevronRight, RotateCcw, ClipboardList, Eye, EyeOff, CheckCircle2, Swords, Sparkles } from 'lucide-react'
import { Header } from '../layout/Header'
import { CategorySection } from './CategorySection'
import { PracticeReader } from './PracticeReader'
import { YesterdayReviewModal } from './YesterdayReviewModal'
import { MissedReasonsModal } from './MissedReasonsModal'
import { PropositoCard } from './PropositoCard'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { useDailyRecords } from '../../hooks/useDailyRecords'
import { useMorningFlow } from '../../hooks/useMorningFlow'
import { useProposito } from '../../hooks/usePropositos'
import { useHideCompleted } from '../../hooks/useSettings'
import { formatDate, getToday, addDay, subDay } from '../../utils/dates'
import type { Practice, Category } from '../../types'

export function DailyView() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(getToday)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [readerPracticeId, setReaderPracticeId] = useState<string | null>(null)
  // Persisted, synced preference: the hide-completed choice survives navigation,
  // reloads, and propagates to other devices. Filters only the list, not the reader pager.
  const [hideCompleted, setHideCompleted] = useHideCompleted()

  const dateStr = formatDate(currentDate)
  const yesterdayStr = formatDate(subDay(currentDate, 1))

  const { categories, isLoading: categoriesLoading } = useCategories()
  const { practices, isLoading: practicesLoading } = usePractices()
  const { isCompleted, togglePractice, markCompleted, clearAllForDate } = useDailyRecords(dateStr)

  const { step, advanceToMissedReasons, completeFlow } = useMorningFlow()

  // Proposito for today
  const { proposito, setProposito, clearProposito } = useProposito(dateStr)

  const practicesByCategory = useMemo(() => {
    const map = new Map<string, Practice[]>()
    for (const category of categories) {
      map.set(category.id, [])
    }
    for (const practice of practices) {
      const list = map.get(practice.categoryId)
      if (list) {
        list.push(practice)
      }
    }
    return map
  }, [categories, practices])

  // Flat ordered list of all practices, for the reader overlay. Includes
  // text-less practices so the reader can page through every practice.
  const readerItems = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c]))
    const items: { practice: Practice; category: Category }[] = []
    for (const category of categories) {
      const categoryPractices = practicesByCategory.get(category.id) ?? []
      for (const practice of categoryPractices) {
        items.push({ practice, category: categoryMap.get(practice.categoryId)! })
      }
    }
    return items
  }, [categories, practicesByCategory])

  const handlePrevDay = () => setCurrentDate((d) => subDay(d, 1))
  const handleNextDay = () => setCurrentDate((d) => addDay(d, 1))

  const handleOpenPracticeDetail = (practice: Practice) => {
    setReaderPracticeId(practice.id)
  }

  const handleClearAll = async () => {
    await clearAllForDate()
    setShowClearDialog(false)
  }

  const hasAnyCompleted = practices.some((p) => isCompleted(p.id))

  if (categoriesLoading || practicesLoading) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        date={currentDate}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        rightAction={
          hasAnyCompleted ? (
            <button
              onClick={() => setShowClearDialog(true)}
              className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Limpar tudo"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleNextDay}
              className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Próximo dia"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )
        }
      />

      <motion.div
        className="flex-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        key={dateStr}
      >
        {/* Proposito card */}
        <div className="px-4 py-2">
          <PropositoCard proposito={proposito} onSetProposito={setProposito} onClearProposito={clearProposito} />
        </div>

        {/* Quick access: midday particular examen + Rosary contemplation */}
        <div className="px-4 pb-2 grid grid-cols-2 gap-2">
          <Link
            to="/exame-particular"
            className="flex items-center justify-center gap-2 p-3 text-sm bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
          >
            <Swords className="w-4 h-4 shrink-0" />
            <span>Exame particular</span>
          </Link>
          <Link
            to="/rosario"
            className="flex items-center justify-center gap-2 p-3 text-sm bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Contemplação do Rosário</span>
          </Link>
        </div>

        {/* Hide-completed toggle — only useful once something is done */}
        {hasAnyCompleted && (
          <div className="px-4 pb-1">
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
            >
              {hideCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {hideCompleted ? 'Mostrar concluídas' : 'Ocultar concluídas'}
            </button>
          </div>
        )}

        {/* Categories and practices */}
        {categories.map((category) => {
          const categoryPractices = practicesByCategory.get(category.id) ?? []
          return (
            <CategorySection
              key={category.id}
              category={category}
              practices={categoryPractices}
              isCompleted={isCompleted}
              onTogglePractice={togglePractice}
              onOpenPracticeDetail={handleOpenPracticeDetail}
              hideCompleted={hideCompleted}
            />
          )
        })}

        {/* When hiding completed empties the whole list, affirm rather than show a blank gap */}
        {hideCompleted && practices.length > 0 && practices.every((p) => isCompleted(p.id)) && (
          <EmptyState icon={CheckCircle2} message="Tudo concluído por hoje" />
        )}

        {practices.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            message="Nenhuma prática cadastrada"
            action={{ label: 'Adicionar práticas', onClick: () => navigate('/settings/practices') }}
          />
        )}
      </motion.div>

      <YesterdayReviewModal isOpen={step === 'yesterday-review'} yesterdayStr={yesterdayStr} onComplete={advanceToMissedReasons} />
      <MissedReasonsModal isOpen={step === 'missed-reasons'} yesterdayStr={yesterdayStr} onComplete={completeFlow} />

      <ConfirmDialog
        isOpen={showClearDialog}
        title="Limpar tudo"
        message="Deseja desmarcar todas as práticas de hoje?"
        confirmLabel="Limpar"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearDialog(false)}
      />

      <AnimatePresence>
        {readerPracticeId && readerItems.length > 0 && (
          <PracticeReader
            items={readerItems}
            initialPracticeId={readerPracticeId}
            isCompleted={isCompleted}
            onTogglePractice={togglePractice}
            onMarkViewed={markCompleted}
            onClose={() => setReaderPracticeId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
