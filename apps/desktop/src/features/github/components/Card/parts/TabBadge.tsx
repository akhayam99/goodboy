import { cn, tintClasses, type Tone } from '@goodboy/ui'
import type { TabStatus } from '../status'

const TONE_MAP: Record<TabStatus['tone'], Tone> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  muted: 'neutral',
}

const BG_OVERRIDE: Partial<Record<TabStatus['tone'], string>> = {
  danger: 'bg-danger/15',
  warning: 'bg-warning/15',
}

type Props = {
  readonly status: TabStatus
  readonly dim: boolean
}

export const TabBadge = ({ status, dim }: Props) => {
  const hasCount = status.count != null && status.count > 0
  const tint = tintClasses(TONE_MAP[status.tone])
  return (
    <span
      aria-label={status.label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1 leading-none transition-opacity',
        tint.bg,
        tint.text,
        BG_OVERRIDE[status.tone],
        dim && 'opacity-80',
      )}
    >
      {status.icon}
      {hasCount ? (
        <span className="text-[9px] font-semibold tabular-nums">{status.count}</span>
      ) : null}
    </span>
  )
}
