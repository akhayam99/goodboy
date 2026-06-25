import { type ReactNode } from 'react'
import { cn } from '@goodboy/ui'

type Props = {
  icon: ReactNode
  label: string
  title?: string
  onClick: () => void
  pulse?: boolean
}

export const QuickAction = ({ icon, label, title, onClick, pulse }: Props) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `browse ${label.toLowerCase()} in the command palette`}
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-1.5 py-1.5 text-2xs font-medium transition-colors',
        pulse
          ? 'animate-soft-pulse border-info/55 bg-info/5 text-foreground hover:bg-info/10'
          : 'border-border-soft bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}
