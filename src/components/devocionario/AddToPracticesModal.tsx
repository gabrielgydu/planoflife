import { useEffect, useState } from 'react'
import { Modal } from '../shared/Modal'
import { CategoryIcon } from '../shared/CategoryIcon'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { prayerTitle } from '../../data/devocionario'
import { COSTUMES_CATEGORY_ID, COSTUMES_CATEGORY_NAME } from '../../data/costumes'
import type { Prayer } from '../../types'

interface AddToPracticesModalProps {
  isOpen: boolean
  prayer: Prayer
  onClose: () => void
}

/**
 * Turn a Devocionário prayer into a tracked practice: pick the category, and the
 * prayer joins the daily checklist and the swipeable reader like any other one.
 *
 * The new practice carries `prayerId` instead of a bundledTextId, so its text stays
 * the live prayer row — editing the prayer updates the practice's reader, and the
 * two can never drift apart.
 */
export function AddToPracticesModal({ isOpen, prayer, onClose }: AddToPracticesModalProps) {
  const { categories } = useCategories()
  const { addPractice } = usePractices()
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  // Default to Costumes when it exists — a prayer added by hand is a custom, not a
  // norm — else the first category. Re-resolved each time the modal opens so it
  // can't hold a category the user deleted meanwhile.
  useEffect(() => {
    if (!isOpen || categories.length === 0) return
    const costumes =
      categories.find((c) => c.id === COSTUMES_CATEGORY_ID) ??
      categories.find((c) => c.name === COSTUMES_CATEGORY_NAME)
    setCategoryId(costumes?.id ?? categories[0].id)
  }, [isOpen, categories])

  const handleAdd = async () => {
    if (!categoryId) return
    setSaving(true)
    try {
      await addPractice({
        name: prayerTitle(prayer),
        categoryId,
        content: '',
        imageData: null,
        prayerId: prayer.id,
        domain: 'spiritual',
        isRequired: false,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
          Adicionar às práticas
        </h2>
        <p className="mt-1 text-sm text-text-secondary dark:text-text-secondary-dark">
          “{prayerTitle(prayer)}” aparecerá na lista diária. Escolha a categoria:
        </p>

        <div className="mt-4 space-y-1.5 max-h-[45vh] overflow-y-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                categoryId === category.id
                  ? 'bg-primary/10 border border-primary text-text-primary dark:text-text-primary-dark'
                  : 'bg-surface-secondary dark:bg-surface-secondary-dark border border-transparent text-text-secondary dark:text-text-secondary-dark hover:bg-border/50 dark:hover:bg-border-dark/50'
              }`}
            >
              <CategoryIcon name={category.emoji} className="w-4 h-4 shrink-0" />
              <span className="text-sm">{category.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg hover:bg-border dark:hover:bg-border-dark transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={!categoryId || saving}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-btn-text dark:text-btn-dark-text bg-btn hover:bg-btn-hover dark:bg-btn-dark dark:hover:bg-btn-dark-hover rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
