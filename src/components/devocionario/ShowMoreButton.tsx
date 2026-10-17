/** The last row of a capped group of search results. */
export function ShowMoreButton({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-sm text-left text-primary dark:text-primary-light hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
    >
      Mostrar mais ({remaining} {remaining === 1 ? 'restante' : 'restantes'})
    </button>
  )
}
