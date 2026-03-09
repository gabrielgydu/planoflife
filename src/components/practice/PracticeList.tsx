import { useCallback } from 'react'
import { useNavigate, Link } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, Archive, ClipboardList, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { EmptyState } from '../shared/EmptyState'
import { CategoryIcon } from '../shared/CategoryIcon'
import type { Practice } from '../../types'

function SortablePracticeItem({ practice }: { practice: Practice }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: practice.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        to={`/settings/practices/${practice.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
      >
        <GripVertical className="w-4 h-4 text-text-muted dark:text-text-muted-dark flex-shrink-0" />
        <span className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">
          {practice.name}
          {practice.isRequired && (
            <span className="ml-1 text-xs text-[#A89548]">*</span>
          )}
        </span>
        <ChevronRight className="w-5 h-5 text-text-muted" />
      </Link>
    </div>
  )
}

function DroppableCategory({ categoryId, children }: { categoryId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `category:${categoryId}` })
  return <div ref={setNodeRef}>{children}</div>
}

export function PracticeList() {
  const navigate = useNavigate()
  const { categories } = useCategories()
  const { practices, reorderPractices, updatePractice } = usePractices({ includeArchived: true })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const activePractices = practices.filter((p) => !p.isArchived)
  const archivedPractices = practices.filter((p) => p.isArchived)

  const groupedPractices = categories.map((cat) => ({
    category: cat,
    practices: activePractices.filter((p) => p.categoryId === cat.id),
  }))

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findCategoryForPractice = useCallback(
    (practiceId: string) => {
      return activePractices.find((p) => p.id === practiceId)?.categoryId
    },
    [activePractices]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      const sourceCategoryId = findCategoryForPractice(activeId)
      if (!sourceCategoryId) return

      // Determine the target category: either from the droppable category zone or from the practice being hovered
      let targetCategoryId: string
      if (overId.startsWith('category:')) {
        targetCategoryId = overId.replace('category:', '')
      } else {
        targetCategoryId = findCategoryForPractice(overId) ?? sourceCategoryId
      }

      const sameCat = sourceCategoryId === targetCategoryId

      if (sameCat) {
        // Reorder within same category
        if (activeId === overId) return
        const catPractices = groupedPractices.find((g) => g.category.id === sourceCategoryId)?.practices ?? []
        const oldIndex = catPractices.findIndex((p) => p.id === activeId)
        const newIndex = catPractices.findIndex((p) => p.id === overId)
        if (oldIndex === -1 || newIndex === -1) return
        const reordered = arrayMove(catPractices, oldIndex, newIndex)
        reorderPractices(sourceCategoryId, reordered.map((p) => p.id))
      } else {
        // Move to different category
        const targetPractices = groupedPractices.find((g) => g.category.id === targetCategoryId)?.practices ?? []

        // Find insertion index — if dropping onto a practice, insert at that position; otherwise append
        let insertIndex = targetPractices.length
        if (!overId.startsWith('category:')) {
          const overIndex = targetPractices.findIndex((p) => p.id === overId)
          if (overIndex !== -1) insertIndex = overIndex
        }

        // Update the practice's category first
        updatePractice(activeId, { categoryId: targetCategoryId }).then(() => {
          // Build the new order for the target category
          const newOrder = [...targetPractices.map((p) => p.id)]
          newOrder.splice(insertIndex, 0, activeId)
          reorderPractices(targetCategoryId, newOrder)

          // Re-order the source category (without the moved practice)
          const sourcePractices = groupedPractices.find((g) => g.category.id === sourceCategoryId)?.practices ?? []
          const sourceOrder = sourcePractices.filter((p) => p.id !== activeId).map((p) => p.id)
          reorderPractices(sourceCategoryId, sourceOrder)
        })
      }
    },
    [findCategoryForPractice, groupedPractices, reorderPractices, updatePractice]
  )

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Práticas
          </h1>
          <Link
            to="/settings/practices/new"
            className="p-2 -mr-2 text-primary dark:text-primary-light hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="divide-y divide-border/30 dark:divide-border-dark">
          {groupedPractices.map(({ category, practices: catPractices }) => (
            <DroppableCategory key={category.id} categoryId={category.id}>
              <div className="px-4 py-2 bg-surface-secondary dark:bg-surface-secondary-dark">
                <span className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest">
                  <CategoryIcon name={category.emoji} className="w-3.5 h-3.5 inline-block mr-1 align-text-bottom" /> {category.name}
                </span>
              </div>
              <SortableContext
                items={catPractices.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {catPractices.map((practice) => (
                  <SortablePracticeItem key={practice.id} practice={practice} />
                ))}
              </SortableContext>
            </DroppableCategory>
          ))}

          {archivedPractices.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-surface-secondary dark:bg-surface-secondary-dark flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />
                <span className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest">
                  Arquivadas
                </span>
              </div>
              {archivedPractices.map((practice) => (
                <Link
                  key={practice.id}
                  to={`/settings/practices/${practice.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors opacity-60"
                >
                  <span className="flex-1 text-sm text-text-secondary dark:text-text-secondary-dark">
                    {practice.name} ({categoryMap.get(practice.categoryId)?.name})
                  </span>
                  <ChevronRight className="w-5 h-5 text-text-muted" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </DndContext>

      {practices.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          message="Nenhuma prática cadastrada"
          action={{ label: 'Adicionar prática', to: '/settings/practices/new' }}
        />
      )}
    </div>
  )
}
