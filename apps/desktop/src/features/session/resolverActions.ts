import type { Agent, TurnState } from '@goodboy/types';
import type { ResolverStatus } from './resolver-linkage';
import { agentThreadIds } from './agentThreadIds';
import type { ResolverThreadTally } from './resolverThreadTally';

export type ResolverActionKind =
  | 'push'
  | 'queue'
  | 'dequeue'
  | 'explain'
  | 'proceed'
  | 'answer'
  | 'review'
  | 'run'
  | 'rerun'
  | 'fix'
  | 'forceClose'
  | 'forceResolve';

export type ResolverActionRole = 'primary' | 'alert' | 'danger' | 'neutral';

export type ResolverActionSurface = 'lane' | 'inspector';

type ResolverActionConfirm = {
  readonly role: 'primary' | 'alert' | 'danger';
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
};

export type ResolverAction = {
  readonly kind: ResolverActionKind;
  readonly label: string;
  readonly role: ResolverActionRole;
  readonly isEnabled: boolean;
  readonly confirm: ResolverActionConfirm | null;
  readonly opensInspector: boolean;
};

export type ResolverActionPlan = {
  readonly primary: ResolverAction | null;
  readonly secondary: ResolverAction | null;
  readonly overflow: ReadonlyArray<ResolverAction>;
  readonly note: string | null;
};

type Params = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly turnState: TurnState | undefined;
  readonly commitSha: string | null;
  readonly tally: ResolverThreadTally;
  readonly surface: ResolverActionSurface;
  readonly queuedThreadIds: ReadonlyArray<string>;
  readonly prNumber: number | null;
  readonly isQueueStalled: boolean;
  readonly hasOtherActiveResolvers: boolean;
};

type Block = {
  readonly primary: ResolverAction | null;
  readonly secondary: ResolverAction | null;
  readonly note: string | null;
};

export const resolverActionOpensPanel = ({ action }: { action: ResolverAction }): boolean =>
  action.opensInspector;

const IDLE: Block = { primary: null, secondary: null, note: null };

const RUN_NOW: ResolverAction = {
  kind: 'run',
  label: 'Run now',
  role: 'primary',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const RUN_AGAIN: ResolverAction = {
  kind: 'rerun',
  label: 'Run again',
  role: 'primary',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const PROCEED: ResolverAction = {
  kind: 'proceed',
  label: 'Proceed with fix',
  role: 'primary',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const ANSWER: ResolverAction = {
  kind: 'answer',
  label: 'Answer in chat',
  role: 'primary',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const REVIEW_THREADS: ResolverAction = {
  kind: 'review',
  label: 'Review threads',
  role: 'primary',
  isEnabled: true,
  confirm: null,
  opensInspector: true,
};

const DEQUEUE: ResolverAction = {
  kind: 'dequeue',
  label: 'Remove from batch',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const FORCE_CLOSE: ResolverAction = {
  kind: 'forceClose',
  label: 'Force close',
  role: 'danger',
  isEnabled: true,
  confirm: {
    role: 'danger',
    title: 'Force close this resolver?',
    description: 'Stops it now and lets the next queued resolver run.',
    confirmLabel: 'Force close',
  },
  opensInspector: false,
};

const MARK_RESOLVED: ResolverAction = {
  kind: 'forceResolve',
  label: 'Mark resolved',
  role: 'alert',
  isEnabled: true,
  confirm: {
    role: 'alert',
    title: 'Mark thread resolved?',
    description: 'Resolves the review thread on GitHub without waiting for the resolver agent.',
    confirmLabel: 'Mark resolved',
  },
  opensInspector: false,
};

const pushAction = ({
  label,
  isEnabled,
}: {
  readonly label: string;
  readonly isEnabled: boolean;
}): ResolverAction => ({
  kind: 'push',
  label,
  role: 'primary',
  isEnabled,
  confirm: {
    role: 'primary',
    title: `${label}?`,
    description: 'Posts the resolution to GitHub and marks the review thread resolved.',
    confirmLabel: label,
  },
  opensInspector: false,
});

const queueAction = ({
  label,
  isEnabled,
}: {
  readonly label: string;
  readonly isEnabled: boolean;
}): ResolverAction => ({
  kind: 'queue',
  label,
  role: 'neutral',
  isEnabled,
  confirm: null,
  opensInspector: false,
});

const explainAction = ({
  label,
  isEnabled,
}: {
  readonly label: string;
  readonly isEnabled: boolean;
}): ResolverAction => ({
  kind: 'explain',
  label,
  role: 'alert',
  isEnabled,
  confirm: {
    role: 'alert',
    title: 'Post explanation and close?',
    description: 'Publishes each thread explanation on GitHub and closes it without a fix.',
    confirmLabel: 'Post & close',
  },
  opensInspector: true,
});

const canForceClose = ({ agent, status }: Pick<Params, 'agent' | 'status'>): boolean =>
  status === 'running' || agent.status === 'running';

const canForceResolve = ({
  agent,
  status,
  turnState,
}: Pick<Params, 'agent' | 'status' | 'turnState'>): boolean => {
  if (agentThreadIds(agent).length === 0) {
    return false;
  }
  if (turnState?.kind === 'running' || turnState?.kind === 'starting') {
    return false;
  }
  return status === 'awaiting' || status === 'failed' || status === 'done' || status === 'stopped';
};

const canPush = ({ tally, commitSha }: Pick<Params, 'tally' | 'commitSha'>): boolean =>
  tally.pushable > 0 || (tally.total === 1 && tally.settled === 0 && commitSha !== null);

const openNote = ({ tally }: Pick<Params, 'tally'>): string | null =>
  tally.open === 0
    ? null
    : tally.open === 1
      ? '1 thread still needs you'
      : `${tally.open} threads still need you`;

const committedBlock = ({
  commitSha,
  tally,
  queuedThreadIds,
  prNumber,
  hasOtherActiveResolvers,
}: Pick<
  Params,
  'commitSha' | 'tally' | 'queuedThreadIds' | 'prNumber' | 'hasOtherActiveResolvers'
>): Block => {
  if (queuedThreadIds.length > 0) {
    return { primary: null, secondary: DEQUEUE, note: 'In the push batch' };
  }
  const isPushable = canPush({ tally, commitSha });
  const queue = queueAction({
    label: 'Add to push batch',
    isEnabled: prNumber !== null && isPushable,
  });
  const note = isPushable ? null : 'no fix recorded on any thread yet';
  if (hasOtherActiveResolvers) {
    return {
      primary: queue,
      secondary: pushAction({ label: 'Push now', isEnabled: isPushable }),
      note,
    };
  }
  return {
    primary: pushAction({ label: 'Push & resolve', isEnabled: isPushable }),
    secondary: queue,
    note,
  };
};

const mixedBlock = (params: Params): Block => {
  if (params.surface === 'lane') {
    return { primary: REVIEW_THREADS, secondary: null, note: null };
  }
  const { tally, queuedThreadIds, prNumber } = params;
  const primary =
    tally.closable > 0
      ? pushAction({ label: `Push & resolve ${tally.closable}`, isEnabled: true })
      : null;
  if (queuedThreadIds.length > 0) {
    return { primary, secondary: DEQUEUE, note: openNote({ tally }) };
  }
  return {
    primary,
    secondary:
      tally.pushable > 0
        ? queueAction({ label: `Add ${tally.pushable} to batch`, isEnabled: prNumber !== null })
        : null,
    note: openNote({ tally }),
  };
};

const statusBlock = (params: Params): Block => {
  const threadCount = agentThreadIds(params.agent).length;
  switch (params.status) {
    case 'pending':
      return params.isQueueStalled ? { primary: RUN_NOW, secondary: null, note: null } : IDLE;
    case 'running':
    case 'resolved':
      return IDLE;
    case 'committed':
      return committedBlock(params);
    case 'analyzed':
      return {
        primary: PROCEED,
        secondary: explainAction({ label: 'Post & close', isEnabled: threadCount > 0 }),
        note: null,
      };
    case 'wontfix':
      return {
        primary: explainAction({
          label: 'Post explanation & close',
          isEnabled: threadCount > 0,
        }),
        secondary: null,
        note: null,
      };
    case 'awaiting':
      return { primary: ANSWER, secondary: null, note: null };
    case 'failed':
    case 'stopped':
    case 'done':
      return {
        primary: RUN_AGAIN,
        secondary: canForceResolve(params) ? MARK_RESOLVED : null,
        note: null,
      };
    default: {
      const exhaustive: never = params.status;
      return exhaustive;
    }
  }
};

const isSettledStatus = ({ status }: Pick<Params, 'status'>): boolean =>
  status !== 'pending' && status !== 'running' && status !== 'resolved';

const blockFor = (params: Params): Block => {
  if (params.tally.isMixed && isSettledStatus(params)) {
    return mixedBlock(params);
  }
  return statusBlock(params);
};

export const resolverActionPlan = (params: Params): ResolverActionPlan => {
  const block = blockFor(params);
  const overflow: Array<ResolverAction> = [];
  if (canForceClose(params)) {
    overflow.push(FORCE_CLOSE);
  }
  if (canForceResolve(params) && block.secondary?.kind !== 'forceResolve') {
    overflow.push(MARK_RESOLVED);
  }
  return { ...block, overflow };
};
