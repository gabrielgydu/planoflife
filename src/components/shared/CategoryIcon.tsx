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
}

export const ICON_OPTIONS = Object.keys(ICON_MAP)

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
