import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { db } from '../../db'
import { useCategories } from '../../hooks/useCategories'
import { Spinner } from '../shared/Spinner'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { CategoryIcon, ICON_OPTIONS } from '../shared/CategoryIcon'

export function CategoryForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { addCategory, updateCategory, deleteCategory } = useCategories()
  const existingCategory = useLiveQuery(() => (id ? db.categories.get(id) : undefined), [id])

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('Cross')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (existingCategory) {
      setName(existingCategory.name)
      setEmoji(existingCategory.emoji)
    }
  }, [existingCategory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    try {
      if (isEditing && id) {
        await updateCategory(id, { name: name.trim(), emoji })
      } else {
        await addCategory({ name: name.trim(), emoji })
      }
      navigate('/settings/categories')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteCategory(id)
    navigate('/settings/categories')
  }

  if (isEditing && existingCategory === undefined) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSaving}
            className="px-3 py-1.5 text-sm font-medium text-primary dark:text-primary-light disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
            Nome
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Nome da categoria"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
            Ícone
          </label>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setEmoji(icon)}
                className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
                  emoji === icon
                    ? 'bg-primary/10 border-2 border-primary text-primary dark:text-primary-light'
                    : 'bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark hover:bg-border dark:hover:bg-border-dark text-text-secondary dark:text-text-secondary-dark'
                }`}
              >
                <CategoryIcon name={icon} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        {isEditing && (
          <div className="pt-4 border-t border-border dark:border-border-dark">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full py-3 text-sm font-medium text-[#9B6B6B] bg-[#9B6B6B]/10 rounded-lg hover:bg-[#9B6B6B]/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir categoria
            </button>
            <p className="mt-2 text-xs text-center text-text-muted dark:text-text-muted-dark">
              Todas as práticas desta categoria também serão excluídas
            </p>
          </div>
        )}
      </form>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Excluir categoria"
        message="Tem certeza? Todas as práticas desta categoria serão excluídas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
        variant="danger"
      />
    </div>
  )
}
