import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, X, ImageIcon, Archive, Trash2 } from 'lucide-react'
import { db } from '../../db'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { Spinner } from '../shared/Spinner'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { compressImage } from '../../utils/imageCompression'

const RichTextEditor = lazy(() =>
  import('../shared/RichTextEditor').then((m) => ({ default: m.RichTextEditor }))
)

export function PracticeForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { categories } = useCategories()
  const { addPractice, updatePractice, deletePractice, archivePractice, unarchivePractice } =
    usePractices()

  const existingPractice = useLiveQuery(() => (id ? db.practices.get(id) : undefined), [id])

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [content, setContent] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)

  useEffect(() => {
    if (existingPractice) {
      setName(existingPractice.name)
      setCategoryId(existingPractice.categoryId)
      setIsRequired(existingPractice.isRequired)
      setContent(existingPractice.content)
      setImageData(existingPractice.imageData)
    } else if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id)
    }
  }, [existingPractice, categories, categoryId])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCompressing(true)
    try {
      const compressed = await compressImage(file)
      setImageData(compressed)
    } catch (err) {
      console.error('Error compressing image:', err)
    } finally {
      setIsCompressing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !categoryId) return

    setIsSaving(true)
    try {
      if (isEditing && id) {
        await updatePractice(id, {
          name: name.trim(),
          categoryId,
          isRequired,
          content,
          imageData,
        })
      } else {
        await addPractice({
          name: name.trim(),
          categoryId,
          isRequired,
          content,
          imageData,
        })
      }
      navigate('/settings/practices')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    await deletePractice(id)
    navigate('/settings/practices')
  }

  const handleArchiveToggle = async () => {
    if (!id || !existingPractice) return
    if (existingPractice.isArchived) {
      await unarchivePractice(id)
    } else {
      await archivePractice(id)
    }
    navigate('/settings/practices')
  }

  if (isEditing && existingPractice === undefined) {
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
            {isEditing ? 'Editar Prática' : 'Nova Prática'}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !categoryId || isSaving}
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
            placeholder="Nome da prática"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Categoria
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.emoji} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Obrigatória</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Práticas obrigatórias pedem justificativa quando não feitas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRequired(!isRequired)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              isRequired ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isRequired ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Imagem
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {imageData ? (
            <div className="relative">
              <img
                src={imageData}
                alt="Preview"
                className="w-full max-h-48 object-contain rounded-lg bg-slate-100 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setImageData(null)}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="w-full py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
            >
              {isCompressing ? (
                <span>Comprimindo...</span>
              ) : (
                <span className="flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8" />
                  Adicionar imagem
                </span>
              )}
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Conteúdo
          </label>
          <Suspense
            fallback={
              <div className="min-h-[200px] p-4 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                <span className="text-slate-400">Carregando editor...</span>
              </div>
            }
          >
            <RichTextEditor content={content} onChange={setContent} placeholder="Adicione instruções ou orações..." />
          </Suspense>
        </div>

        {isEditing && existingPractice && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <button
              type="button"
              onClick={handleArchiveToggle}
              className="w-full py-3 text-sm font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <Archive className="w-4 h-4" />
              {existingPractice.isArchived ? 'Desarquivar' : 'Arquivar'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full py-3 text-sm font-medium text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir prática
            </button>
          </div>
        )}
      </form>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Excluir prática"
        message="Tem certeza que deseja excluir esta prática? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
        variant="danger"
      />
    </div>
  )
}
