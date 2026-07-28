import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { BookX, ChevronLeft, ListPlus, ListX, MoreVertical, Pencil, Star, Trash2 } from 'lucide-react'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { AddToPracticesModal } from './AddToPracticesModal'
import { usePrayer, usePrayers } from '../../hooks/usePrayers'
import { usePracticeForPrayer } from '../../hooks/usePracticeForPrayer'
import { usePractices } from '../../hooks/usePractices'
import { PRACTICE_TEXT_LANG_KEY } from '../../data/bundledTexts'
import {
  prayerLang,
  prayerLangs,
  prayerText,
  prayerTitle,
  sectionName,
  type PrayerLang,
} from '../../data/devocionario'

const LANG_LABELS: Record<PrayerLang, string> = {
  pt: 'Portugues',
  la: 'Latim',
}

/**
 * Full-screen reader for one prayer. The pt/la switch reuses the device-local
 * PRACTICE_TEXT_LANG_KEY preference the practice readers use, so choosing Latin
 * anywhere in the app keeps it everywhere on that device (and nowhere else — it is
 * deliberately not synced).
 */
export function PrayerReader() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const prayer = usePrayer(id)
  const { toggleFavorite, deletePrayer } = usePrayers()
  const { deletePractice } = usePractices()
  const linkedPractice = usePracticeForPrayer(id)

  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRemovePracticeDialog, setShowRemovePracticeDialog] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [lang, setLang] = useState<PrayerLang>(() =>
    localStorage.getItem(PRACTICE_TEXT_LANG_KEY) === 'la' ? 'la' : 'pt'
  )

  useEffect(() => {
    localStorage.setItem(PRACTICE_TEXT_LANG_KEY, lang)
  }, [lang])

  if (prayer === undefined) return <Spinner className="h-64" />
  if (prayer === null) {
    return (
      <EmptyState
        icon={BookX}
        message="Oração não encontrada"
        action={{ label: 'Voltar ao devocionário', to: '/devocionario' }}
      />
    )
  }

  const langs = prayerLangs(prayer)
  const activeLang = prayerLang(prayer, lang)
  const isUser = prayer.source === 'user'

  const handleDelete = async () => {
    await deletePrayer(prayer.id)
    setShowDeleteDialog(false)
    navigate('/devocionario')
  }

  const handleRemoveFromPractices = async () => {
    if (linkedPractice) await deletePractice(linkedPractice.id)
    setShowRemovePracticeDialog(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-full flex flex-col bg-surface dark:bg-surface-dark"
    >
      <header className="sticky top-0 z-10 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center px-2 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={() => navigate('/devocionario')}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 text-center px-1">
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
              {sectionName(prayer.section)}
            </p>
            <h1 className="font-heading text-base font-semibold text-text-primary dark:text-text-primary-dark truncate mt-0.5">
              {prayerTitle(prayer, activeLang)}
            </h1>
          </div>

          <button
            onClick={() => toggleFavorite(prayer.id)}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label={prayer.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorita'}
            aria-pressed={prayer.isFavorite}
          >
            <Star
              className={`w-5 h-5 ${prayer.isFavorite ? 'fill-[#A89548] text-[#A89548]' : ''}`}
            />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Mais opções"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 py-1 bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-lg shadow-lg">
                  {linkedPractice ? (
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        setShowRemovePracticeDialog(true)
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-text-primary dark:text-text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                    >
                      <ListX className="w-4 h-4 shrink-0" />
                      Remover das práticas
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        setShowAddModal(true)
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-text-primary dark:text-text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                    >
                      <ListPlus className="w-4 h-4 shrink-0" />
                      Adicionar às práticas
                    </button>
                  )}

                  {isUser && (
                    <>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          navigate(`/devocionario/${prayer.id}/edit`)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-text-primary dark:text-text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                      >
                        <Pencil className="w-4 h-4 shrink-0" />
                        Editar oração
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          setShowDeleteDialog(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-[#9B6B6B] dark:text-gray-400 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Excluir oração
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        <div className="mx-auto w-full max-w-2xl p-5 pb-24">
          <MarkdownRenderer
            markdown={prayerText(prayer, activeLang)}
            className="prose-prayer"
            key={activeLang}
          />
        </div>

        {langs.length > 1 && (
          <button
            onClick={() => setLang((l) => (l === 'pt' ? 'la' : 'pt'))}
            className="fixed bottom-4 right-4 px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
          >
            {activeLang === 'pt' ? LANG_LABELS.la : LANG_LABELS.pt}
          </button>
        )}
      </div>

      <AddToPracticesModal
        isOpen={showAddModal}
        prayer={prayer}
        onClose={() => setShowAddModal(false)}
      />

      <ConfirmDialog
        isOpen={showRemovePracticeDialog}
        title="Remover das práticas"
        message={`Remover "${prayerTitle(prayer)}" da lista diária? A oração continua no devocionário; o histórico dessa prática é apagado.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={handleRemoveFromPractices}
        onCancel={() => setShowRemovePracticeDialog(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Excluir oração"
        message={
          linkedPractice
            ? `Excluir "${prayerTitle(prayer)}"? A prática correspondente e o seu histórico também serão removidos. Esta ação não pode ser desfeita.`
            : `Excluir "${prayerTitle(prayer)}"? Esta ação não pode ser desfeita.`
        }
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </motion.div>
  )
}
