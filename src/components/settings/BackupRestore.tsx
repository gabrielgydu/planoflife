import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Download, Upload, AlertTriangle, Lock, FilePlus } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  exportBackup,
  importBackup,
  downloadBackup,
  downloadEncryptedBackup,
  parseBackupFile,
  parseEncryptedBackupFile,
  parsePracticeImportFile,
  importPractices,
} from '../../utils/backup'
import type { PracticeImportItem } from '../../utils/backup'
import { db } from '../../db'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { PasswordInput } from '../shared/PasswordInput'

export function BackupRestore() {
  const navigate = useNavigate()
  const categories = useLiveQuery(() => db.categories.toArray()) ?? []
  const fileInputRef = useRef<HTMLInputElement>(null)
  const practiceFileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportingPractices, setIsImportingPractices] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showPracticeConfirmDialog, setShowPracticeConfirmDialog] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPractices, setPendingPractices] = useState<PracticeImportItem[]>([])
  const [exportPassword, setExportPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isEncryptedExport = exportPassword.length > 0

  const handleExport = async () => {
    setError(null)
    setIsExporting(true)
    try {
      const backup = await exportBackup()
      if (isEncryptedExport) {
        await downloadEncryptedBackup(backup, exportPassword)
      } else {
        downloadBackup(backup)
      }
      setSuccess('Backup exportado com sucesso!')
      setExportPassword('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Erro ao exportar backup')
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setPendingFile(file)

    if (file.name.endsWith('.enc')) {
      setImportPassword('')
      setShowPasswordPrompt(true)
    } else {
      setShowConfirmDialog(true)
    }

    e.target.value = ''
  }

  const handlePasswordSubmit = () => {
    if (!importPassword) return
    setShowPasswordPrompt(false)
    setShowConfirmDialog(true)
  }

  const handlePracticeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    try {
      const items = await parsePracticeImportFile(file)
      setPendingPractices(items)
      setShowPracticeConfirmDialog(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ler arquivo')
    }
    e.target.value = ''
  }

  const handlePracticeImportConfirm = async () => {
    setShowPracticeConfirmDialog(false)
    setIsImportingPractices(true)
    setError(null)
    try {
      const count = await importPractices(pendingPractices, categories)
      setSuccess(`${count} práticas importadas com sucesso!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar práticas')
      console.error(err)
    } finally {
      setIsImportingPractices(false)
      setPendingPractices([])
    }
  }

  const handleImportConfirm = async () => {
    if (!pendingFile) return

    setShowConfirmDialog(false)
    setIsImporting(true)
    setError(null)

    try {
      const isEncrypted = pendingFile.name.endsWith('.enc')
      const backup = isEncrypted
        ? await parseEncryptedBackupFile(pendingFile, importPassword)
        : await parseBackupFile(pendingFile)
      await importBackup(backup)
      setSuccess('Backup importado com sucesso! Recarregue a página.')
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar backup')
      console.error(err)
    } finally {
      setIsImporting(false)
      setPendingFile(null)
      setImportPassword('')
    }
  }

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
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark pr-10">
            Backup e Restauração
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-4 bg-[#9B6B6B]/10 border border-[#9B6B6B]/30 rounded-lg">
            <p className="text-sm text-[#9B6B6B]">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
            <p className="text-sm text-success">{success}</p>
          </div>
        )}

        {/* Export section */}
        <section className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-4">
          <div className="flex items-start gap-4">
            <Download className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                Exportar Backup
              </h2>
              <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
                Salva todas as suas práticas, registros e exames em um arquivo.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-text-secondary-dark mb-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Senha (opcional)
                  </label>
                  <PasswordInput
                    value={exportPassword}
                    onChange={setExportPassword}
                    placeholder="Deixe vazio para exportar sem criptografia"
                  />
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="px-4 py-2.5 text-sm font-medium text-btn-text dark:text-btn-dark-text bg-btn dark:bg-btn-dark rounded-lg hover:bg-btn-hover disabled:opacity-50 transition-colors"
                >
                  {isExporting
                    ? 'Exportando...'
                    : isEncryptedExport
                      ? 'Exportar Criptografado'
                      : 'Exportar Backup'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Import section */}
        <section className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-4">
          <div className="flex items-start gap-4">
            <Upload className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                Importar Backup
              </h2>
              <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
                Restaura dados de um arquivo de backup. Isso substituirá todos os dados atuais.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.enc"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark disabled:opacity-50 transition-colors"
              >
                {isImporting ? 'Importando...' : 'Selecionar Arquivo'}
              </button>
            </div>
          </div>
        </section>

        {/* Import practices section */}
        <section className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-4">
          <div className="flex items-start gap-4">
            <FilePlus className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                Importar Práticas
              </h2>
              <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
                Adiciona práticas a partir de um arquivo JSON. Não substitui dados existentes.
              </p>
              <input
                ref={practiceFileInputRef}
                type="file"
                accept=".json"
                onChange={handlePracticeFileSelect}
                className="hidden"
              />
              <button
                onClick={() => practiceFileInputRef.current?.click()}
                disabled={isImportingPractices}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark disabled:opacity-50 transition-colors"
              >
                {isImportingPractices ? 'Importando...' : 'Selecionar Arquivo'}
              </button>
            </div>
          </div>
        </section>

        {/* Warning */}
        <div className="p-4 bg-[#A89548]/10 dark:bg-gray-400/10 border border-[#A89548]/30 dark:border-gray-400/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#A89548] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
                Importante
              </p>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                Faça backups regulares! O iOS pode limpar dados de apps não usados por mais de 7 dias.
                Exporte seu backup pelo menos uma vez por semana.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Password prompt for encrypted import */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                setShowPasswordPrompt(false)
                setPendingFile(null)
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative bg-surface-card dark:bg-surface-card-dark rounded-2xl shadow-lg max-w-sm w-full p-6"
            >
              <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                Backup Criptografado
              </h2>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4">
                Digite a senha usada para criptografar este backup.
              </p>
              <div className="mb-6">
                <PasswordInput
                  value={importPassword}
                  onChange={setImportPassword}
                  placeholder="Senha do backup"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false)
                    setPendingFile(null)
                  }}
                  className="flex-1 py-2.5 px-4 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg hover:bg-border dark:hover:bg-border-dark transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!importPassword}
                  className="flex-1 py-2.5 px-4 text-sm font-medium text-btn-text dark:text-btn-dark-text bg-btn dark:bg-btn-dark rounded-lg hover:bg-btn-hover disabled:opacity-50 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showPracticeConfirmDialog}
        title="Importar Práticas"
        message={`Importar ${pendingPractices.length} práticas?`}
        confirmLabel="Importar"
        onConfirm={handlePracticeImportConfirm}
        onCancel={() => {
          setShowPracticeConfirmDialog(false)
          setPendingPractices([])
        }}
        variant="default"
      />

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Importar Backup"
        message="Isso substituirá TODOS os dados atuais pelo conteúdo do backup. Tem certeza?"
        confirmLabel="Importar"
        onConfirm={handleImportConfirm}
        onCancel={() => {
          setShowConfirmDialog(false)
          setPendingFile(null)
          setImportPassword('')
        }}
        variant="danger"
      />
    </div>
  )
}
