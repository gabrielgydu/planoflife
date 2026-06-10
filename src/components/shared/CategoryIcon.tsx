import {
  Sunrise,
  Sun,
  Clock,
  CloudSun,
  Moon,
  Church,
  Cross,
  BookOpen,
  Heart,
  Star,
  Flame,
  HandHeart,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Sunrise,
  Sun,
  Clock,
  CloudSun,
  Moon,
  Church,
  Cross,
  BookOpen,
  Heart,
  Star,
  Flame,
  HandHeart,
  Briefcase,
}

// Briefcase renders (career category, seeded via sync) but is deliberately NOT
// offered in the public category-icon picker — installs without career data
// keep the exact pre-career option list.
export const ICON_OPTIONS = Object.keys(ICON_MAP).filter((n) => n !== 'Briefcase')

export function CategoryIcon({
  name,
  className = 'w-4 h-4',
}: {
  name: string
  className?: string
}) {
  const Icon = ICON_MAP[name]
  if (!Icon) return <span className={className}>{name}</span>
  return <Icon className={className} />
}
