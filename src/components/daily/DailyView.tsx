import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router'
import { RotateCcw, ClipboardList, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Header } from '../layout/Header'
import { CategorySection, type CatchUpRow } from './CategorySection'
import { PracticeReader } from './PracticeReader'
import { MeditationView } from './MeditationView'
import { AntiphonView } from './AntiphonView'
import { LiturgiaView } from './LiturgiaView'
import { NovoTestamentoView } from './NovoTestamentoView'
import { RosaryContemplationView } from '../rosary/RosaryContemplationView'
import { RosaryPrayerView } from '../rosary/RosaryPrayerView'
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
import { useDailyRecords, toggleRecordOn } from '../../hooks/useDailyRecords'
import { useNovenaCatchUp } from '../../hooks/useNovenaCatchUp'
import { useWeeklyCompletions } from '../../hooks/useWeeklyCompletion'
import { useMorningFlow } from '../../hooks/useMorningFlow'
import { useProposito } from '../../hooks/usePropositos'
import {
  useHideCompleted,
  useDailyViewMode,
  useNovenaStart,
  useCollapsedCategories,
  DAILY_VIEW_MODES,
} from '../../hooks/useSettings'
import { PLANO_DE_VIDA_CATEGORY_ID, isSantaMissaPractice } from '../../data/planoDeVida'
import { isNovoTestamentoPractice } from '../../data/novoTestamento'
import { COSTUMES_CATEGORY_ID } from '../../data/costumes'
import { isPracticeVisibleOn, novenaCatchUpSubtitle } from '../../data/novena'
import { isScheduledOn, isWeekly, isOnMonthlySchedule } from '../../utils/schedule'
import { isMeditacaoPractice, getMeditacaoSlot } from '../../data/meditation'
import { isRosaryContemplationPractice, isSantoRosarioPractice } from '../../data/rosary'
import { isExameParticularPractice } from '../../data/exame'
import { isAntiphonPractice } from '../../data/antiphon'
import {
  formatDate,
  formatDateShort,
  getToday,
  addDay,
  subDay,
  isToday,
  parseDate,
  relativeDayLabel,
} from '../../utils/dates'
import type { Practice, Category } from '../../types'

export function DailyView() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(getToday)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [readerPracticeId, setReaderPracticeId] = useState<string | null>(null)
  // A catch-up row's reader: the missed day (YYYY-MM-DD) whose novena text is
  // open, or null. Separate from readerPracticeId because everything about it —
  // content, check state, the record its ✓ writes — belongs to THAT day.
  const [catchUpReaderDate, setCatchUpReaderDate] = useState<string | null>(null)
  // Persisted, synced preference: the hide-completed choice survives navigation,
  // reloads, and propagates to other devices. Filters only the list, not the reader pager.
  const [hideCompleted, setHideCompleted] = useHideCompleted()
  // FAB-cycled visibility mode (also persisted + synced): the plan-of-life core,
  // only the extras, or everything.
  const [viewMode, setViewMode] = useDailyViewMode()
  // Folded categories are a preference too: they stay folded across navigation,
  // app restarts, and the other device.
  const { isCollapsed, toggleCategory } = useCollapsedCategories()
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

  // Auto-mark-on-view (PracticeReader on open/swipe, AntiphonView on open) is a
  // convenience for the day you are actually living: it records a practice as
  // done merely because its reader was on screen. On any other day that records
  // something the user never did — and on a FUTURE day it is worse than noise,
  // because a pre-checked practice is then hidden from that day's own list by
  // hide-completed, so it silently disappears before it has been prayed. Same
  // rule useMeditationDay already applies to its auto-draw. Deliberate taps
  // (the ✓ in a row or a reader header) still work on any day.
  const markViewed = useCallback(
    (practiceId: string) => {
      if (isToday(currentDate)) void markCompleted(practiceId)
    },
    [currentDate, markCompleted],
  )

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
  const matchesViewMode = useCallback(
    (p: Practice) => {
      if (viewMode === 'all') return true
      const inPlano =
        p.categoryId === PLANO_DE_VIDA_CATEGORY_ID ||
        p.categoryId === COSTUMES_CATEGORY_ID ||
        p.isRequired
      return viewMode === 'plano' ? inPlano : !inPlano
    },
    [viewMode],
  )
  const visiblePractices = useMemo(
    () => activePractices.filter(matchesViewMode),
    [activePractices, matchesViewMode],
  )

  // Missed days of the current novena run: the run advances even when a day
  // goes unprayed, so today's list also offers the day(s) left behind, each as
  // its own checkable row writing to ITS date. Only on the real today —
  // browsing another date shows that date's own practices as ever.
  const { practice: novenaPractice, days: novenaCatchUpDays } = useNovenaCatchUp(
    practices,
    novenaStart,
    isToday(currentDate),
  )
  const catchUpRows = useMemo<CatchUpRow[]>(() => {
    if (!novenaPractice || !matchesViewMode(novenaPractice)) return []
    return novenaCatchUpDays
      .filter((d) => !d.completed)
      .map((d) => ({
        practice: novenaPractice,
        dateStr: d.dateStr,
        subtitle: novenaCatchUpSubtitle(d.dayIndex, d.date),
      }))
  }, [novenaPractice, matchesViewMode, novenaCatchUpDays])
  const handleToggleCatchUp = (row: CatchUpRow) => void toggleRecordOn(row.dateStr, row.practice.id)
  const handleOpenCatchUpDetail = (row: CatchUpRow) => setCatchUpReaderDate(row.dateStr)

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
        // contemplation, the rosary praying engine, the Marian antiphon, Santa
        // Missa's liturgy, the New Testament read-through) have their own overlay
        // (see below); keep them out of the text pager so swiping never lands on
        // an empty placeholder.
        if (
          isMeditacaoPractice(practice) ||
          isRosaryContemplationPractice(practice) ||
          isSantoRosarioPractice(practice) ||
          isExameParticularPractice(practice) ||
          isAntiphonPractice(practice) ||
          isSantaMissaPractice(practice) ||
          isNovoTestamentoPractice(practice)
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
  const openedIsSantoRosario = openedPractice ? isSantoRosarioPractice(openedPractice) : false
  const openedIsExameParticular = openedPractice
    ? isExameParticularPractice(openedPractice)
    : false
  const openedIsAntiphon = openedPractice ? isAntiphonPractice(openedPractice) : false
  const openedIsSantaMissa = openedPractice ? isSantaMissaPractice(openedPractice) : false
  const openedIsNovoTestamento = openedPractice ? isNovoTestamentoPractice(openedPractice) : false

  // The open catch-up reader, resolved to everything it needs. Its ✓ toggles
  // the MISSED day's record; auto-mark-on-view stays off (same policy as any
  // non-today date — only a deliberate tap marks a day you are not living).
  const catchUpNovenaCategory = categories.find((c) => c.id === novenaPractice?.categoryId)
  const catchUpReader =
    catchUpReaderDate && novenaPractice && catchUpNovenaCategory
      ? { dateStr: catchUpReaderDate, practice: novenaPractice, category: catchUpNovenaCategory }
      : null
  const ignoreViewed = useCallback(() => {}, [])

  // Both directions, unbounded: a day ahead is as legitimate a target as a day
  // behind. Saturday evening's vigil Mass is Sunday's liturgy and belongs on
  // Sunday's record, so "tomorrow" has to be reachable and markable.
  const handlePrevDay = () => setCurrentDate((d) => subDay(d, 1))
  const handleNextDay = () => setCurrentDate((d) => addDay(d, 1))
  const handleToday = () => setCurrentDate(getToday())

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
        onToday={handleToday}
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

        {/* Hide-completed and clear-all — both only useful once something is done,
            so they share one row. Clearing lives here rather than in the header:
            up there it took over the forward-day chevron, so the control under
            the thumb changed meaning the moment a practice was checked. */}
        {hasAnyCompleted && (
          <div className="px-4 pb-1 flex items-center justify-between gap-3">
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
            >
              {hideCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {hideCompleted ? 'Mostrar concluídas' : 'Ocultar concluídas'}
            </button>
            <button
              onClick={() => setShowClearDialog(true)}
              className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Limpar tudo
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
              catchUpRows={
                catchUpRows.length > 0 && category.id === novenaPractice?.categoryId
                  ? catchUpRows
                  : undefined
              }
              onToggleCatchUp={handleToggleCatchUp}
              onOpenCatchUpDetail={handleOpenCatchUpDetail}
              isCompleted={isCompletedEffective}
              onTogglePractice={toggleEffective}
              onOpenPracticeDetail={handleOpenPracticeDetail}
              hideCompleted={hideCompleted}
              isExpanded={!isCollapsed(category.id)}
              onToggleExpanded={() => toggleCategory(category.id)}
            />
          )
        })}

        {/* When hiding completed empties the whole list, affirm rather than show a blank gap */}
        {hideCompleted &&
          visiblePractices.length > 0 &&
          catchUpRows.length === 0 &&
          visiblePractices.every((p) => isCompletedEffective(p.id)) && (
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
        message={`Deseja desmarcar todas as práticas de ${
          relativeDayLabel(currentDate)?.toLocaleLowerCase('pt-BR') ?? formatDateShort(currentDate)
        }?`}
        confirmLabel="Limpar"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearDialog(false)}
      />

      <AnimatePresence>
        {catchUpReader ? (
          <PracticeReader
            items={[{ practice: catchUpReader.practice, category: catchUpReader.category }]}
            initialPracticeId={catchUpReader.practice.id}
            viewDate={parseDate(catchUpReader.dateStr)}
            novenaStart={novenaStart}
            isCompleted={() =>
              novenaCatchUpDays.find((d) => d.dateStr === catchUpReader.dateStr)?.completed ?? false
            }
            onTogglePractice={() =>
              void toggleRecordOn(catchUpReader.dateStr, catchUpReader.practice.id)
            }
            onMarkViewed={ignoreViewed}
            onClose={() => setCatchUpReaderDate(null)}
          />
        ) : openedPractice && openedIsExameParticular ? (
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
        ) : openedPractice && openedIsSantoRosario ? (
          <RosaryPrayerView
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
            onMarkViewed={markViewed}
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
        ) : openedPractice && openedIsNovoTestamento ? (
          <NovoTestamentoView
            practiceId={openedPractice.id}
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
              onMarkViewed={markViewed}
              onClose={() => setReaderPracticeId(null)}
            />
          )
        )}
      </AnimatePresence>
    </div>
  )
}
