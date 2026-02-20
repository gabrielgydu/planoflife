import { Loader2 } from 'lucide-react'

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' } as const

interface SpinnerProps {
  size?: keyof typeof sizes
  className?: string
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className={`${sizes[size]} animate-spin text-slate-400 dark:text-slate-500`} />
    </div>
  )
}
