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
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            {isEditing ? 'Editar Prática' : 'Nova Prática'}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !categoryId || isSaving}
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
            className="w-full px-4 py-3 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
            placeholder="Nome da prática"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
            Categoria
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Obrigatória</span>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Práticas obrigatórias pedem justificativa quando não feitas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRequired(!isRequired)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              isRequired ? 'bg-btn dark:bg-btn-dark' : 'bg-border dark:bg-border-dark'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-btn-text dark:bg-btn-dark-text rounded-full shadow transition-transform ${
                isRequired ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
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
                className="w-full max-h-48 object-contain rounded-lg bg-surface-secondary dark:bg-surface-secondary-dark"
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
              className="w-full py-8 border-2 border-dashed border-border dark:border-border-dark rounded-lg text-text-muted dark:text-text-muted-dark hover:border-text-muted dark:hover:border-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
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
          <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
            Conteúdo
          </label>
          <Suspense
            fallback={
              <div className="min-h-[200px] p-4 bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg flex items-center justify-center">
                <span className="text-text-muted">Carregando editor...</span>
              </div>
            }
          >
            <RichTextEditor content={content} onChange={setContent} placeholder="Adicione instruções ou orações..." />
          </Suspense>
        </div>

        {isEditing && existingPractice && (
          <div className="pt-4 border-t border-border dark:border-border-dark space-y-3">
            <button
              type="button"
              onClick={handleArchiveToggle}
              className="w-full py-3 text-sm font-medium text-[#A89548] dark:text-gray-400 bg-[#A89548]/10 dark:bg-gray-400/10 rounded-lg hover:bg-[#A89548]/20 transition-colors flex items-center justify-center gap-2"
            >
              <Archive className="w-4 h-4" />
              {existingPractice.isArchived ? 'Desarquivar' : 'Arquivar'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full py-3 text-sm font-medium text-[#9B6B6B] dark:text-gray-500 bg-[#9B6B6B]/10 dark:bg-gray-500/10 rounded-lg hover:bg-[#9B6B6B]/20 transition-colors flex items-center justify-center gap-2"
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
