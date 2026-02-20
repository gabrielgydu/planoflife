import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Download, Upload, AlertTriangle } from 'lucide-react'
import { exportBackup, importBackup, downloadBackup, parseBackupFile } from '../../utils/backup'
import { ConfirmDialog } from '../shared/ConfirmDialog'

export function BackupRestore() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleExport = async () => {
    setError(null)
    setIsExporting(true)
    try {
      const backup = await exportBackup()
      downloadBackup(backup)
      setSuccess('Backup exportado com sucesso!')
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
    setShowConfirmDialog(true)

    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!pendingFile) return

    setShowConfirmDialog(false)
    setIsImporting(true)
    setError(null)

    try {
      const backup = await parseBackupFile(pendingFile)
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
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
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
                Salva todas as suas práticas, registros e exames em um arquivo JSON.
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {isExporting ? 'Exportando...' : 'Exportar Backup'}
              </button>
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
                accept=".json"
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

        {/* Warning */}
        <div className="p-4 bg-[#A89548]/10 border border-[#A89548]/30 rounded-lg">
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

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Importar Backup"
        message="Isso substituirá TODOS os dados atuais pelo conteúdo do backup. Tem certeza?"
        confirmLabel="Importar"
        onConfirm={handleImportConfirm}
        onCancel={() => {
          setShowConfirmDialog(false)
          setPendingFile(null)
        }}
        variant="danger"
      />
    </div>
  )
}
