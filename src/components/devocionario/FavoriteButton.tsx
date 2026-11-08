import { Star } from 'lucide-react'

/**
 * The star that marks a prayer or a point as a favorite. It usually sits inside a
 * row's link, so a tap on it must neither follow the link nor bubble to it.
 */
export function FavoriteButton({
  isFavorite,
  onToggle,
  addLabel,
  className = '-m-1',
}: {
  isFavorite: boolean
  onToggle: () => void
  /** "Marcar como favorita" for a prayer, "Marcar como favorito" for a point. */
  addLabel: string
  /** Margins pulling the tap target into the surrounding line; `-m-1` by default. */
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={`p-2 shrink-0 text-text-muted dark:text-text-muted-dark hover:text-[#A89548] transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light ${className}`}
      aria-label={isFavorite ? 'Remover dos favoritos' : addLabel}
      aria-pressed={isFavorite}
    >
      <Star className={`w-4 h-4 ${isFavorite ? 'fill-[#A89548] text-[#A89548]' : ''}`} />
    </button>
  )
}
