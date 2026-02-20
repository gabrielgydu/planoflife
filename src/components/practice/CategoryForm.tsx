import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { db } from '../../db'
import { useCategories } from '../../hooks/useCategories'
import { Spinner } from '../shared/Spinner'
import { ConfirmDialog } from '../shared/ConfirmDialog'

const EMOJI_OPTIONS = ['🌅', '☀️', '🕛', '🌤️', '🌙', '⛪', '📿', '✝️', '🙏', '📖', '❤️', '⭐']

export function CategoryForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { addCategory, updateCategory, deleteCategory } = useCategories()
  const existingCategory = useLiveQuery(() => (id ? db.categories.get(id) : undefined), [id])

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📿')
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
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSaving}
            className="px-3 py-1.5 text-sm font-medium text-primary dark:text-indigo-400 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Nome
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Nome da categoria"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Emoji
          </label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-12 h-12 text-2xl rounded-lg transition-colors ${
                  emoji === e
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {isEditing && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full py-3 text-sm font-medium text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir categoria
            </button>
            <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
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
