import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '../cn'
import { tintClasses, type Tone } from '../tint'
import { Eyebrow } from './Eyebrow'

export type StatCardProps = {
  readonly value: string
  readonly label: string
  readonly hint?: string
  readonly icon?: ReactNode
  readonly tone?: Tone
  readonly alert?: boolean
  readonly valueSize?: 'lg' | 'xl'
  readonly status?: ReactNode
  readonly onClick?: () => void
  readonly className?: string
}

const valueSizeClasses: Record<'lg' | 'xl', string> = {
  lg: 'text-lg',
  xl: 'text-xl',
}

export const StatCard = ({
  value,
  label,
  hint,
  icon,
  tone,
  alert,
  valueSize = 'xl',
  status,
  onClick,
  className,
}: StatCardProps) => {
  const tint = tone ? tintClasses(tone) : null

  const body = (
    <>
      {icon && tint ? (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
            tint.bg,
            tint.ring,
            tint.icon,
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow label={label} />
          {status ?? null}
        </div>
        <span className={cn('font-mono tabular-nums text-foreground', valueSizeClasses[valueSize])}>
          {value}
        </span>
        {hint ? <span className="text-2xs text-muted-foreground/70">{hint}</span> : null}
      </div>
      {onClick ? <ArrowRight size={14} aria-hidden className="text-muted-foreground" /> : null}
    </>
  )

  const shell = cn(
    icon && tint ? 'flex items-start gap-3' : 'flex flex-col gap-1',
    'rounded-lg border bg-muted/20 px-4 py-3',
    alert ? 'border-warning/40' : 'border-border-soft',
    className,
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(shell, 'text-left motion-safe:transition-colors hover:bg-muted/40')}
      >
        {body}
      </button>
    )
  }

  return <div className={shell}>{body}</div>
}
