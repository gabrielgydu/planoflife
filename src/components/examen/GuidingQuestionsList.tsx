import { useState } from 'react'
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
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
            Perguntas Orientadoras
          </h1>
          <button
            onClick={() => handleOpenForm()}
            className="p-2 -mr-2 text-primary dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
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
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <SortableList
            items={questions}
            onReorder={handleReorder}
            renderItem={(question) => (
              <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-slate-900">
                <span className="text-slate-300 dark:text-slate-600 cursor-grab">
                  <GripVertical className="w-5 h-5" />
                </span>
                <span className="flex-1 text-sm text-slate-900 dark:text-slate-100">{question.text}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenForm(question)
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    archiveQuestion(question.id)
                  }}
                  className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl shadow-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Digite a pergunta orientadora..."
                className="w-full h-24 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <div className="flex gap-3 pb-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg"
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
          </div>
        </div>
      )}

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
