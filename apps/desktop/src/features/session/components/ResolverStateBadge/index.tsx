import { Chip, cn, type Tone } from '@goodboy/ui';
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
  readonly count?: number;
  readonly className?: string;
};

const COPY: Record<ResolverBadgeState, string> = {
  queued: 'queued',
  working: 'working',
  needsYou: 'needs you',
  failed: 'failed',
  resolved: 'resolved',
};

const TONE: Record<ResolverBadgeState, Tone> = {
  queued: 'neutral',
  working: 'info',
  needsYou: 'warning',
  failed: 'danger',
  resolved: 'success',
};

export const ResolverStateBadge = ({ state, count, className }: ResolverStateBadgeProps) => (
  <Chip
    tone={TONE[state]}
    size="3xs"
    bordered={false}
    icon={<ResolverStateIcon state={state} />}
    label={count ?? COPY[state]}
    ariaLabel={count == null ? undefined : `${count} ${COPY[state]}`}
    className={cn('shrink-0', className)}
  />
);
