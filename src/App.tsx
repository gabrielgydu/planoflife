import { BrowserRouter, Routes, Route } from 'react-router'
import { useEffect } from 'react'
import { usePracticeFontSize, useUIFontSize } from './hooks/useSettings'
import { AppShell } from './components/layout/AppShell'
import { DailyView } from './components/daily/DailyView'
import { ExamenView } from './components/examen/ExamenView'
import { ExamenHistoryView } from './components/examen/ExamenHistoryView'
import { ConfessionView } from './components/examen/ConfessionView'
import { GuidingQuestionsList } from './components/examen/GuidingQuestionsList'
import { HistoryView } from './components/history/HistoryView'
import { DayDetail } from './components/history/DayDetail'
import { SettingsView } from './components/settings/SettingsView'
import { PracticeList } from './components/practice/PracticeList'
import { PracticeDetail } from './components/practice/PracticeDetail'
import { PracticeForm } from './components/practice/PracticeForm'
import { CategoryManager } from './components/practice/CategoryManager'
import { CategoryForm } from './components/practice/CategoryForm'
import { BackupRestore } from './components/settings/BackupRestore'
import { PdfExport } from './components/settings/PdfExport'
import { InstallBanner } from './components/shared/InstallBanner'
import { seedDatabase } from './db/seed'
import { migrateEmojisToIcons } from './db'

export function App() {
  usePracticeFontSize()
  useUIFontSize()

  useEffect(() => {
    seedDatabase().then(() => migrateEmojisToIcons())
  }, [])

  return (
    <BrowserRouter basename="/planoflife">
      <InstallBanner />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DailyView />} />
          <Route path="/examen" element={<ExamenView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
        <Route path="/history/:date" element={<DayDetail />} />
        <Route path="/examen/history" element={<ExamenHistoryView />} />
        <Route path="/examen/confession" element={<ConfessionView />} />
        <Route path="/examen/questions" element={<GuidingQuestionsList />} />
        <Route path="/examen/:date" element={<ExamenView />} />
        <Route path="/settings/practices" element={<PracticeList />} />
        <Route path="/settings/practices/new" element={<PracticeForm />} />
        <Route path="/settings/practices/:id" element={<PracticeDetail />} />
        <Route path="/settings/practices/:id/edit" element={<PracticeForm />} />
        <Route path="/settings/categories" element={<CategoryManager />} />
        <Route path="/settings/categories/new" element={<CategoryForm />} />
        <Route path="/settings/categories/:id/edit" element={<CategoryForm />} />
        <Route path="/settings/backup" element={<BackupRestore />} />
        <Route path="/settings/pdf" element={<PdfExport />} />
      </Routes>
    </BrowserRouter>
  )
}
