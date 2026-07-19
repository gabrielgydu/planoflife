import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router'
import { ChevronRight, RotateCcw, ClipboardList, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Header } from '../layout/Header'
import { CategorySection } from './CategorySection'
import { PracticeReader } from './PracticeReader'
import { MeditationView } from './MeditationView'
import { AntiphonView } from './AntiphonView'
import { LiturgiaView } from './LiturgiaView'
import { RosaryContemplationView } from '../rosary/RosaryContemplationView'
import { ExameParticularView } from '../examen/ExameParticularView'
import { YesterdayReviewModal } from './YesterdayReviewModal'
import { MissedReasonsModal } from './MissedReasonsModal'
import { PropositoCard } from './PropositoCard'
import { ViewModeFab } from './ViewModeFab'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { useDailyRecords } from '../../hooks/useDailyRecords'
import { useWeeklyCompletions } from '../../hooks/useWeeklyCompletion'
import { useMorningFlow } from '../../hooks/useMorningFlow'
import { useProposito } from '../../hooks/usePropositos'
import { useHideCompleted, useDailyViewMode, useNovenaStart, DAILY_VIEW_MODES } from '../../hooks/useSettings'
import { PLANO_DE_VIDA_CATEGORY_ID, isSantaMissaPractice } from '../../data/planoDeVida'
import { COSTUMES_CATEGORY_ID } from '../../data/costumes'
import { isPracticeVisibleOn } from '../../data/novena'
import { isScheduledOn, isWeekly, isOnMonthlySchedule } from '../../utils/schedule'
import { isMeditacaoPractice, getMeditacaoSlot } from '../../data/meditation'
import { isRosaryContemplationPractice } from '../../data/rosary'
import { isExameParticularPractice } from '../../data/exame'
import { isAntiphonPractice } from '../../data/antiphon'
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
  // FAB-cycled visibility mode (also persisted + synced): the plan-of-life core,
  // only the extras, or everything.
  const [viewMode, setViewMode] = useDailyViewMode()
  // The manually-started novena (settings) shows outside 17–25 June for nine days.
  const { start: novenaStart } = useNovenaStart()
  const cycleViewMode = () => {
    const next = DAILY_VIEW_MODES[(DAILY_VIEW_MODES.indexOf(viewMode) + 1) % DAILY_VIEW_MODES.length]
    setViewMode(next)
  }

  const dateStr = formatDate(currentDate)
  const yesterdayStr = formatDate(subDay(currentDate, 1))

  const { categories, isLoading: categoriesLoading } = useCategories()
  const { practices, isLoading: practicesLoading } = usePractices()
  const { isCompleted, togglePractice, markCompleted, clearAllForDate } = useDailyRecords(dateStr)
  const { completedIdsInWeek, clearWeek } = useWeeklyCompletions(dateStr)

  // Weekly-cadence practices (Confissão) count as done for the whole Mon-start
  // week once checked on any of its days; unchecking clears the whole week.
  // THIS pair — not the raw per-day API — is what every consumer below gets, so
  // row state, category counts, hide-completed, and the readers all agree.
  const weeklyIds = useMemo(() => new Set(practices.filter(isWeekly).map((p) => p.id)), [practices])
  const isCompletedEffective = (practiceId: string): boolean =>
    weeklyIds.has(practiceId) ? completedIdsInWeek.has(practiceId) : isCompleted(practiceId)
  const toggleEffective = (practiceId: string) => {
    if (weeklyIds.has(practiceId) && completedIdsInWeek.has(practiceId)) {
      return clearWeek(practiceId)
    }
    return togglePractice(practiceId)
  }

  const { step, advanceToMissedReasons, completeFlow } = useMorningFlow()

  // Proposito for today
  const { proposito, setProposito, clearProposito } = useProposito(dateStr)

  // Only practices that apply to the day being viewed: inside their calendar
  // window (a seasonal practice like the novena appears only on its dates) AND
  // on their weekday schedule (a Saturday-only practice hides Mon–Fri). Ordinary
  // practices have neither → always active.
  const activePractices = useMemo(
    () =>
      practices.filter(
        (p) =>
          isPracticeVisibleOn(p, currentDate, novenaStart) &&
          isScheduledOn(p, currentDate) &&
          isOnMonthlySchedule(p, currentDate)
      ),
    [practices, currentDate, novenaStart]
  )

  // The FAB mode narrows what the day shows: 'plano' = the Plano de Vida and
  // Costumes categories plus any required practice elsewhere; 'extras' = the
  // exact complement; 'all' = everything. Composes with hide-completed (below).
  const visiblePractices = useMemo(() => {
    if (viewMode === 'all') return activePractices
    const inPlano = (p: Practice) =>
      p.categoryId === PLANO_DE_VIDA_CATEGORY_ID ||
      p.categoryId === COSTUMES_CATEGORY_ID ||
      p.isRequired
    return activePractices.filter((p) => (viewMode === 'plano' ? inPlano(p) : !inPlano(p)))
  }, [activePractices, viewMode])

  const practicesByCategory = useMemo(() => {
    const map = new Map<string, Practice[]>()
    for (const category of categories) {
      map.set(category.id, [])
    }
    for (const practice of visiblePractices) {
      const list = map.get(practice.categoryId)
      if (list) {
        list.push(practice)
      }
    }
    return map
  }, [categories, visiblePractices])

  // Flat ordered list of all practices, for the reader overlay. Includes
  // text-less practices so the reader can page through every practice.
  const readerItems = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c]))
    const items: { practice: Practice; category: Category }[] = []
    for (const category of categories) {
      const categoryPractices = practicesByCategory.get(category.id) ?? []
      for (const practice of categoryPractices) {
        // Practices with a dedicated reader (either meditation slot, the rosary
        // contemplation, the Marian antiphon, Santa Missa's liturgy) have their
        // own overlay (see below); keep them out of the text pager so swiping
        // never lands on an empty placeholder.
        if (
          isMeditacaoPractice(practice) ||
          isRosaryContemplationPractice(practice) ||
          isExameParticularPractice(practice) ||
          isAntiphonPractice(practice) ||
          isSantaMissaPractice(practice)
        )
          continue
        items.push({ practice, category: categoryMap.get(practice.categoryId)! })
      }
    }
    return items
  }, [categories, practicesByCategory])

  // A meditation practice (morning "Meditação" or afternoon "Meditação da Tarde")
  // opens a dedicated 3-card Escrivá reader instead of the text pager. Resolve the
  // currently-opened practice → its slot; null when the open reader isn't a meditation.
  const openedPractice = useMemo(
    () => activePractices.find((p) => p.id === readerPracticeId) ?? null,
    [activePractices, readerPracticeId],
  )
  const openedMeditacaoSlot = openedPractice ? getMeditacaoSlot(openedPractice) : null
  const openedIsRosaryContemplation = openedPractice
    ? isRosaryContemplationPractice(openedPractice)
    : false
  const openedIsExameParticular = openedPractice
    ? isExameParticularPractice(openedPractice)
    : false
  const openedIsAntiphon = openedPractice ? isAntiphonPractice(openedPractice) : false
  const openedIsSantaMissa = openedPractice ? isSantaMissaPractice(openedPractice) : false

  const handlePrevDay = () => setCurrentDate((d) => subDay(d, 1))
  const handleNextDay = () => setCurrentDate((d) => addDay(d, 1))

  const handleOpenPracticeDetail = (practice: Practice) => {
    setReaderPracticeId(practice.id)
  }

  const handleClearAll = async () => {
    await clearAllForDate()
    setShowClearDialog(false)
  }

  const hasAnyCompleted = visiblePractices.some((p) => isCompletedEffective(p.id))

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
        className="flex-1 mx-auto w-full max-w-2xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        key={dateStr}
      >
        {/* Proposito card */}
        <div className="px-4 py-2">
          <PropositoCard proposito={proposito} onSetProposito={setProposito} onClearProposito={clearProposito} />
        </div>

        {/* The midday particular examen and the rosary contemplation are now tracked
            practices (tap them in the list) — no more quick-access buttons here. */}

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
              viewDate={currentDate}
              novenaStart={novenaStart}
              isCompleted={isCompletedEffective}
              onTogglePractice={toggleEffective}
              onOpenPracticeDetail={handleOpenPracticeDetail}
              hideCompleted={hideCompleted}
            />
          )
        })}

        {/* When hiding completed empties the whole list, affirm rather than show a blank gap */}
        {hideCompleted && visiblePractices.length > 0 && visiblePractices.every((p) => isCompletedEffective(p.id)) && (
          <EmptyState icon={CheckCircle2} message="Tudo concluído por hoje" />
        )}

        {/* The current mode has nothing to show, but other practices exist */}
        {visiblePractices.length === 0 && activePractices.length > 0 && (
          <EmptyState icon={ClipboardList} message="Nenhuma prática neste modo" />
        )}

        {activePractices.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            message="Nenhuma prática cadastrada"
            action={{ label: 'Adicionar práticas', onClick: () => navigate('/settings/practices') }}
          />
        )}
      </motion.div>

      <ViewModeFab mode={viewMode} onCycle={cycleViewMode} />

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
        {openedPractice && openedIsExameParticular ? (
          <ExameParticularView
            practiceId={openedPractice.id}
            isCompleted={isCompletedEffective}
            onTogglePractice={toggleEffective}
            onClose={() => setReaderPracticeId(null)}
          />
        ) : openedPractice && openedIsRosaryContemplation ? (
          <RosaryContemplationView
            practiceId={openedPractice.id}
            viewDate={currentDate}
            isCompleted={isCompletedEffective}
            onTogglePractice={toggleEffective}
            onClose={() => setReaderPracticeId(null)}
          />
        ) : openedPractice && openedIsAntiphon ? (
          <AntiphonView
            practiceId={openedPractice.id}
            viewDate={currentDate}
            isCompleted={isCompletedEffective}
            onTogglePractice={toggleEffective}
            onMarkViewed={markCompleted}
            onClose={() => setReaderPracticeId(null)}
          />
        ) : openedPractice && openedIsSantaMissa ? (
          <LiturgiaView
            practiceId={openedPractice.id}
            viewDate={currentDate}
            isCompleted={isCompletedEffective}
            onTogglePractice={toggleEffective}
            onClose={() => setReaderPracticeId(null)}
          />
        ) : openedPractice && openedMeditacaoSlot ? (
          <MeditationView
            practiceId={openedPractice.id}
            slot={openedMeditacaoSlot}
            title={openedPractice.name}
            viewDate={currentDate}
            isCompleted={isCompletedEffective}
            onTogglePractice={toggleEffective}
            onClose={() => setReaderPracticeId(null)}
          />
        ) : (
          readerPracticeId &&
          readerItems.length > 0 && (
            <PracticeReader
              items={readerItems}
              initialPracticeId={readerPracticeId}
              viewDate={currentDate}
              novenaStart={novenaStart}
              isCompleted={isCompletedEffective}
              onTogglePractice={toggleEffective}
              onMarkViewed={markCompleted}
              onClose={() => setReaderPracticeId(null)}
            />
          )
        )}
      </AnimatePresence>
    </div>
  )
}
