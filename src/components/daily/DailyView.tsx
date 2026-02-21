import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { ChevronRight, RotateCcw, ClipboardList } from 'lucide-react'
import { Header } from '../layout/Header'
import { CategorySection } from './CategorySection'
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
import { formatDate, getToday, addDay, subDay } from '../../utils/dates'
import type { Practice } from '../../types'

export function DailyView() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(getToday)
  const [showClearDialog, setShowClearDialog] = useState(false)

  const dateStr = formatDate(currentDate)
  const yesterdayStr = formatDate(subDay(currentDate, 1))

  const { categories, isLoading: categoriesLoading } = useCategories()
  const { practices, isLoading: practicesLoading } = usePractices()
  const { isCompleted, togglePractice, clearAllForDate } = useDailyRecords(dateStr)

  const { step, advanceToMissedReasons, completeFlow } = useMorningFlow()

  // Proposito for today
  const { proposito, setProposito } = useProposito(dateStr)

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

  const handlePrevDay = () => setCurrentDate((d) => subDay(d, 1))
  const handleNextDay = () => setCurrentDate((d) => addDay(d, 1))

  const handleOpenPracticeDetail = (practice: Practice) => {
    navigate(`/settings/practices/${practice.id}`)
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
          <PropositoCard proposito={proposito} onSetProposito={setProposito} />
        </div>

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
            />
          )
        })}

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
    </div>
  )
}
