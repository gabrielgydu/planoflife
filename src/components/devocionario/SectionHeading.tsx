/** The grey band that titles a group of rows in the Devocionário. */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 bg-surface-secondary dark:bg-surface-secondary-dark">
      <span className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest">
        {children}
      </span>
    </div>
  )
}
