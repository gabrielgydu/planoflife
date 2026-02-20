import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Plus, GripVertical, Pencil, Archive, HelpCircle } from 'lucide-react'
import { useGuidingQuestions } from '../../hooks/useGuidingQuestions'
import { SortableList } from '../shared/SortableList'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import type { GuidingQuestion } from '../../types'

export function GuidingQuestionsList() {
  const navigate = useNavigate()
  const {
    questions,
    isLoading,
    addQuestion,
    updateQuestion,
    archiveQuestion,
    deleteQuestion,
    reorderQuestions,
  } = useGuidingQuestions()

  const [showForm, setShowForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<GuidingQuestion | null>(null)
  const [formText, setFormText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleOpenForm = (question?: GuidingQuestion) => {
    if (question) {
      setEditingQuestion(question)
      setFormText(question.text)
    } else {
      setEditingQuestion(null)
      setFormText('')
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formText.trim()) return
    if (editingQuestion) {
      await updateQuestion(editingQuestion.id, formText.trim())
    } else {
      await addQuestion(formText.trim())
    }
    setShowForm(false)
    setFormText('')
    setEditingQuestion(null)
  }

  const handleReorder = async (reordered: GuidingQuestion[]) => {
    await reorderQuestions(reordered.map((q) => q.id))
  }

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteQuestion(deleteTarget)
      setDeleteTarget(null)
    }
  }

  if (isLoading) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Perguntas Orientadoras
          </h1>
          <button
            onClick={() => handleOpenForm()}
            className="p-2 -mr-2 text-primary dark:text-primary-light hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {questions.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          message="Nenhuma pergunta orientadora cadastrada"
          action={{ label: 'Adicionar pergunta', onClick: () => handleOpenForm() }}
        />
      ) : (
        <div className="divide-y divide-border/30 dark:divide-border-dark">
          <SortableList
            items={questions}
            onReorder={handleReorder}
            renderItem={(question) => (
              <div className="flex items-center gap-3 px-4 py-4 bg-surface-card dark:bg-surface-dark">
                <span className="text-text-muted dark:text-text-muted-dark cursor-grab">
                  <GripVertical className="w-5 h-5" />
                </span>
                <span className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">{question.text}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenForm(question)
                  }}
                  className="p-1.5 text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    archiveQuestion(question.id)
                  }}
                  className="p-1.5 text-text-muted hover:text-[#A89548] transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-lg bg-surface-card dark:bg-surface-card-dark rounded-t-2xl shadow-lg"
            >
            <div className="p-4 border-b border-border dark:border-border-dark">
              <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Digite a pergunta orientadora..."
                className="w-full h-24 px-4 py-3 bg-surface-secondary dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <div className="flex gap-3 pb-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formText.trim()}
                  className="flex-1 py-3 text-sm font-medium text-white bg-primary rounded-lg disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir pergunta"
        message="Tem certeza que deseja excluir esta pergunta?"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  )
}
