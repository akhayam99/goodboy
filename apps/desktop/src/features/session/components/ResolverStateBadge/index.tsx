import { cn } from '@goodboy/ui';
import type { ResolverStatus } from '../../resolver-linkage';
import { ResolverStateIcon } from './ResolverStateIcon';

export type ResolverBadgeState = 'queued' | 'working' | 'needsYou' | 'failed' | 'resolved';

export const resolverBadgeState = (status: ResolverStatus): ResolverBadgeState => {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'running':
      return 'working';
    case 'failed':
      return 'failed';
    case 'resolved':
      return 'resolved';
    case 'committed':
    case 'analyzed':
    case 'wontfix':
    case 'awaiting':
    case 'stopped':
    case 'done':
      return 'needsYou';
    default: {
      const exhaustive: never = status;
      throw new Error(`unknown resolver status: ${String(exhaustive)}`);
    }
  }
};

export const resolverStateSentence = (status: ResolverStatus): string | null => {
  switch (status) {
    case 'committed':
      return 'fix committed, ready to push';
    case 'analyzed':
      return 'verdict ready';
    case 'wontfix':
      return 'recommends closing without a change';
    case 'awaiting':
      return 'asked you a question';
    case 'stopped':
      return 'stopped before a verdict';
    case 'done':
      return 'finished without a verdict';
    case 'pending':
    case 'running':
    case 'failed':
    case 'resolved':
      return null;
    default: {
      const exhaustive: never = status;
      throw new Error(`unknown resolver status: ${String(exhaustive)}`);
    }
  }
};

type ResolverStateBadgeProps = {
  readonly state: ResolverBadgeState;
  readonly className?: string;
};

const COPY: Record<ResolverBadgeState, string> = {
  queued: 'queued',
  working: 'working',
  needsYou: 'needs you',
  failed: 'failed',
  resolved: 'resolved',
};

const TINT: Record<ResolverBadgeState, string> = {
  queued: 'bg-muted text-muted-foreground',
  working: 'bg-info/10 text-info',
  needsYou: 'bg-warning/10 text-warning',
  failed: 'bg-danger/10 text-danger',
  resolved: 'bg-success/10 text-success',
};

export const ResolverStateBadge = ({ state, className }: ResolverStateBadgeProps) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-3xs font-medium',
      TINT[state],
      className,
    )}
  >
    <ResolverStateIcon state={state} />
    {COPY[state]}
  </span>
);
