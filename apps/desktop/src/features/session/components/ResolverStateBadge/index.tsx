import { StatusDot, cn } from '@goodboy/ui'
import { AlertTriangle, Ban, Check, CheckCheck, Clock, GitCommit } from 'lucide-react'
import type { ResolverStatus } from '../../resolver-linkage'

export type ResolverBadgeState =
  | 'none'
  | 'running'
  | 'queued'
  | 'committed'
  | 'resolved'
  | 'wontfix'
  | 'awaiting'
  | 'failed'

export const resolverBadgeState = (status: ResolverStatus): ResolverBadgeState => {
  switch (status) {
    case 'running':
      return 'running'
    case 'pending':
      return 'queued'
    case 'committed':
      return 'committed'
    case 'resolved':
      return 'resolved'
    case 'wontfix':
      return 'wontfix'
    case 'awaiting':
      return 'awaiting'
    case 'failed':
      return 'failed'
    default:
      return 'none'
  }
}

type ResolverStateBadgeProps = {
  readonly state: ResolverBadgeState
  readonly className?: string
}

const COPY: Record<ResolverBadgeState, string> = {
  none: 'done',
  running: 'working',
  queued: 'queued',
  committed: 'pending push',
  resolved: 'resolved',
  wontfix: 'explained',
  awaiting: 'needs you',
  failed: 'failed',
}

export const ResolverStateBadge = ({ state, className }: ResolverStateBadgeProps) => {
  const icon =
    state === 'running' ? (
      <StatusDot tone="info" size="sm" pulsing />
    ) : state === 'failed' ? (
      <span className="size-1.5 rounded-full bg-danger" aria-hidden />
    ) : state === 'queued' ? (
      <Clock size={10} className="text-muted-foreground/60" aria-hidden />
    ) : state === 'resolved' ? (
      <CheckCheck size={10} className="text-success" aria-hidden />
    ) : state === 'committed' ? (
      <GitCommit size={10} className="text-warning" aria-hidden />
    ) : state === 'wontfix' ? (
      <Ban size={10} className="text-muted-foreground/70" aria-hidden />
    ) : state === 'awaiting' ? (
      <AlertTriangle size={10} className="text-warning" aria-hidden />
    ) : (
      <Check size={10} className="text-muted-foreground/70" aria-hidden />
    )
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        state === 'resolved'
          ? 'bg-success/10 text-success'
          : state === 'committed' || state === 'awaiting'
            ? 'bg-warning/10 text-warning'
            : state === 'failed'
              ? 'bg-danger/10 text-danger'
              : state === 'running'
                ? 'bg-info/10 text-info'
                : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {icon}
      {COPY[state]}
    </span>
  )
}
