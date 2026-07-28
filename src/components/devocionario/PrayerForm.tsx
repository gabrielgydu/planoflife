import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BookX, ChevronLeft } from 'lucide-react'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { usePrayer, usePrayers } from '../../hooks/usePrayers'
import { usePracticeForPrayer } from '../../hooks/usePracticeForPrayer'
import { usePractices } from '../../hooks/usePractices'

const inputClass =
  'w-full px-4 py-3 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50'

/**
 * Write or edit one of the user's own prayers. The bundled Devocionário prayers are
 * verbatim from opusdei.org and deliberately not editable — the reader only offers
 * this route for `source: 'user'` rows.
 *
 * Text is plain markdown, rendered by the same MarkdownRenderer as the bundled
 * prayers: a blank line starts a paragraph, a single newline is a line break.
 */
export function PrayerForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const prayer = usePrayer(id)
  const { addPrayer, updatePrayer } = usePrayers()
  const linkedPractice = usePracticeForPrayer(id)
  const { updatePractice } = usePractices()

  const [titlePt, setTitlePt] = useState('')
  const [textPt, setTextPt] = useState('')
  const [titleLa, setTitleLa] = useState('')
  const [textLa, setTextLa] = useState('')
  const [showLatin, setShowLatin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!prayer) return
    setTitlePt(prayer.title.pt ?? '')
    setTextPt(prayer.texts.pt ?? '')
    setTitleLa(prayer.title.la ?? '')
    setTextLa(prayer.texts.la ?? '')
    if (prayer.title.la || prayer.texts.la) setShowLatin(true)
  }, [prayer])

  const canSave = titlePt.trim().length > 0 && textPt.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    try {
      const title = { pt: titlePt.trim(), ...(titleLa.trim() ? { la: titleLa.trim() } : {}) }
      const texts = { pt: textPt.trim(), ...(textLa.trim() ? { la: textLa.trim() } : {}) }
      if (isEditing && id) {
        await updatePrayer(id, { title, texts })
        // A practice tracking this prayer shows the prayer's title in the daily
        // list, so a rename has to reach it too — otherwise the checklist keeps
        // the old name forever.
        if (linkedPractice && linkedPractice.name !== title.pt) {
          await updatePractice(linkedPractice.id, { name: title.pt })
        }
        navigate(`/devocionario/${id}`)
      } else {
        const created = await addPrayer({ title, texts })
        navigate(`/devocionario/${created.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  if (isEditing && prayer === undefined) return <Spinner className="h-64" />
  if (isEditing && prayer === null) {
    return (
      <EmptyState
        icon={BookX}
        message="Oração não encontrada"
        action={{ label: 'Voltar ao devocionário', to: '/devocionario' }}
      />
    )
  }
  if (prayer && prayer.source !== 'user') {
    return (
      <EmptyState
        icon={BookX}
        message="As orações do devocionário não podem ser editadas"
        action={{ label: 'Voltar', to: `/devocionario/${prayer.id}` }}
      />
    )
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            {isEditing ? 'Editar oração' : 'Nova oração'}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={!canSave || saving}
            className="px-3 py-1.5 text-sm font-medium text-primary dark:text-primary-light disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6 mx-auto w-full max-w-2xl">
        <div>
          <label
            htmlFor="prayer-title-pt"
            className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2"
          >
            Título
          </label>
          <input
            id="prayer-title-pt"
            type="text"
            value={titlePt}
            onChange={(e) => setTitlePt(e.target.value)}
            className={inputClass}
            placeholder="Nome da oração"
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="prayer-text-pt"
            className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2"
          >
            Texto
          </label>
          <textarea
            id="prayer-text-pt"
            value={textPt}
            onChange={(e) => setTextPt(e.target.value)}
            rows={14}
            className={`${inputClass} font-mono text-sm leading-relaxed`}
            placeholder={'Texto da oração.\n\nUma linha em branco começa um novo parágrafo; **negrito** e *itálico* funcionam.'}
          />
        </div>

        {showLatin ? (
          <div className="space-y-6 pt-2 border-t border-border dark:border-border-dark">
            <div>
              <label
                htmlFor="prayer-title-la"
                className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2 mt-6"
              >
                Título em latim (opcional)
              </label>
              <input
                id="prayer-title-la"
                type="text"
                value={titleLa}
                onChange={(e) => setTitleLa(e.target.value)}
                className={inputClass}
                placeholder="Titulus latine"
              />
            </div>
            <div>
              <label
                htmlFor="prayer-text-la"
                className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2"
              >
                Texto em latim (opcional)
              </label>
              <textarea
                id="prayer-text-la"
                value={textLa}
                onChange={(e) => setTextLa(e.target.value)}
                rows={14}
                className={`${inputClass} font-mono text-sm leading-relaxed`}
                placeholder="Textus latine"
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLatin(true)}
            className="w-full py-3 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg hover:bg-border dark:hover:bg-border-dark transition-colors"
          >
            Adicionar versão em latim
          </button>
        )}
      </form>
    </div>
  )
}
