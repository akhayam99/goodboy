import { cn } from '@goodboy/ui';
import type { ResolverStatus } from '../../resolver-linkage';
import { ResolverStateIcon } from './ResolverStateIcon';

export type ResolverBadgeState =
  | 'none'
  | 'running'
  | 'queued'
  | 'committed'
  | 'analyzed'
  | 'resolved'
  | 'wontfix'
  | 'awaiting'
  | 'stopped'
  | 'failed';

export const resolverBadgeState = (status: ResolverStatus): ResolverBadgeState => {
  switch (status) {
    case 'running':
      return 'running';
    case 'pending':
      return 'queued';
    case 'committed':
      return 'committed';
    case 'analyzed':
      return 'analyzed';
    case 'resolved':
      return 'resolved';
    case 'wontfix':
      return 'wontfix';
    case 'awaiting':
      return 'awaiting';
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    default:
      return 'none';
  }
};

type ResolverStateBadgeProps = {
  readonly state: ResolverBadgeState;
  readonly className?: string;
};

const COPY: Record<ResolverBadgeState, string> = {
  none: 'done',
  running: 'working',
  queued: 'queued',
  committed: 'pending push',
  analyzed: 'verdict ready',
  resolved: 'resolved',
  wontfix: 'explained',
  awaiting: 'needs you',
  stopped: 'stopped',
  failed: 'failed',
};

export const ResolverStateBadge = ({ state, className }: ResolverStateBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        state === 'resolved'
          ? 'bg-success/10 text-success'
          : state === 'committed' || state === 'awaiting' || state === 'analyzed'
            ? 'bg-warning/10 text-warning'
            : state === 'failed' || state === 'stopped'
              ? 'bg-danger/10 text-danger'
              : state === 'running'
                ? 'bg-info/10 text-info'
                : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <ResolverStateIcon state={state} />
      {COPY[state]}
    </span>
  );
};
