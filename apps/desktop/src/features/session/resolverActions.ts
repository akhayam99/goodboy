import type { Agent, TurnState } from '@goodboy/types';
import type { ResolverStatus } from './resolver-linkage';
import { agentThreadIds } from './agentThreadIds';

export type ResolverActionKind =
  | 'push'
  | 'queue'
  | 'dequeue'
  | 'explain'
  | 'proceed'
  | 'continue'
  | 'run'
  | 'forceClose'
  | 'forceResolve';

export type ResolverActionRole = 'primary' | 'alert' | 'danger' | 'neutral';

type ResolverActionReason = 'required' | 'optional';

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
  readonly reason: ResolverActionReason | null;
};

type Params = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly turnState: TurnState | undefined;
  readonly commitSha: string | null;
  readonly queuedThreadIds: ReadonlyArray<string>;
  readonly prNumber: number | null;
};

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

const statusActions = ({
  agent,
  status,
  commitSha,
  queuedThreadIds,
  prNumber,
}: Omit<Params, 'turnState'>): ReadonlyArray<ResolverAction> => {
  const threadIds = agentThreadIds(agent);
  if (status === 'committed') {
    const isQueued = queuedThreadIds.length > 0;
    const label = isQueued ? 'Push now' : 'Push & resolve';
    const push: ResolverAction = {
      kind: 'push',
      label,
      role: 'primary',
      isEnabled: isQueued || (threadIds.length > 0 && commitSha !== null),
      confirm: {
        role: 'primary',
        title: `${label}?`,
        description: 'Posts the resolution to GitHub and marks the review thread resolved.',
        confirmLabel: label,
      },
      reason: null,
    };
    if (isQueued) {
      return [
        {
          kind: 'dequeue',
          label: 'Remove from batch',
          role: 'neutral',
          isEnabled: true,
          confirm: null,
          reason: null,
        },
        push,
      ];
    }
    return [
      push,
      {
        kind: 'queue',
        label: 'Queue for batch push',
        role: 'neutral',
        isEnabled: prNumber !== null && threadIds.length > 0 && commitSha !== null,
        confirm: null,
        reason: null,
      },
    ];
  }

  if (status === 'wontfix' || status === 'analyzed') {
    const explain: ResolverAction = {
      kind: 'explain',
      label: 'Post explanation & close',
      role: 'alert',
      isEnabled: threadIds.length > 0,
      confirm: {
        role: 'alert',
        title: 'Post explanation and close?',
        description:
          'Publishes the explanation on GitHub and closes the review thread without a fix.',
        confirmLabel: 'Post & close',
      },
      reason: 'required',
    };
    if (status === 'analyzed') {
      return [
        {
          kind: 'proceed',
          label: 'Proceed with fix',
          role: 'neutral',
          isEnabled: true,
          confirm: null,
          reason: null,
        },
        explain,
      ];
    }
    return [explain];
  }

  if (status === 'awaiting') {
    return [
      {
        kind: 'continue',
        label: 'Continue working',
        role: 'neutral',
        isEnabled: true,
        confirm: null,
        reason: null,
      },
    ];
  }

  if (status === 'pending') {
    return [
      {
        kind: 'run',
        label: 'Run now',
        role: 'neutral',
        isEnabled: true,
        confirm: null,
        reason: null,
      },
    ];
  }

  return [];
};

export const resolverActions = (params: Params): ReadonlyArray<ResolverAction> => {
  const forced: Array<ResolverAction> = [];
  if (canForceClose(params)) {
    forced.push({
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
      reason: null,
    });
  }
  if (canForceResolve(params)) {
    forced.push({
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
      reason: 'optional',
    });
  }
  return [...statusActions(params), ...forced];
};
