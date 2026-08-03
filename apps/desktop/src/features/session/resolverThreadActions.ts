import type { ResolverAction } from './resolverActions';
import type { ResolverThreadSettlement } from './resolverThreadSettlements';

export type ResolverThreadActionPlan = {
  readonly primary: ResolverAction | null;
  readonly overflow: ReadonlyArray<ResolverAction>;
};

type Params = {
  readonly settlement: ResolverThreadSettlement;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
};

const ANSWER: ResolverAction = {
  kind: 'answer',
  label: 'Answer in chat',
  role: 'primary',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const DEQUEUE: ResolverAction = {
  kind: 'dequeue',
  label: 'Remove from batch',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const MARK_RESOLVED: ResolverAction = {
  kind: 'forceResolve',
  label: 'Mark resolved',
  role: 'alert',
  isEnabled: true,
  confirm: {
    role: 'alert',
    title: 'Mark this thread resolved?',
    description: 'Closes it on GitHub with the reply above, without waiting for a verdict.',
    confirmLabel: 'Mark resolved',
  },
  opensInspector: false,
};

const POST_AND_CLOSE: ResolverAction = {
  kind: 'explain',
  label: 'Post & close',
  role: 'alert',
  isEnabled: true,
  confirm: {
    role: 'alert',
    title: 'Post explanation and close?',
    description: 'Publishes this reply on the thread and closes it on GitHub without a fix.',
    confirmLabel: 'Post & close',
  },
  opensInspector: false,
};

const FIX_ANYWAY: ResolverAction = {
  kind: 'fix',
  label: 'Fix it anyway',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const queueAction = ({ isEnabled }: { readonly isEnabled: boolean }): ResolverAction => ({
  kind: 'queue',
  label: 'Add to batch',
  role: 'neutral',
  isEnabled,
  confirm: null,
  opensInspector: false,
});

export const resolverThreadActions = ({
  settlement,
  prNumber,
  isBusy,
}: Params): ResolverThreadActionPlan => {
  if (settlement.isClosed) {
    return { primary: null, overflow: [] };
  }
  if (settlement.kind === 'resolved') {
    return {
      primary: settlement.isQueued ? DEQUEUE : queueAction({ isEnabled: prNumber !== null }),
      overflow: [],
    };
  }
  if (settlement.kind === 'open') {
    return { primary: ANSWER, overflow: isBusy ? [] : [MARK_RESOLVED] };
  }
  return { primary: POST_AND_CLOSE, overflow: isBusy ? [] : [FIX_ANYWAY] };
};
