import type { ResolverStatus } from './resolver-linkage';

export type ResolverActGate = {
  readonly canAct: boolean;
  readonly reason: string | null;
};

const RESOLVER_LOCK_REASON = {
  pending: 'Queued behind another resolver, it cannot take instructions yet',
  running: 'The agent is working on this resolver right now',
  resolved: 'Already pushed to GitHub, nothing left to steer',
  busy: 'The agent is working on this thread, wait for it to finish',
  batched: 'Queued in the push batch, remove it from the batch to steer it again',
} as const;

const AGENT_REASON: Partial<Record<ResolverStatus, string>> = {
  pending: RESOLVER_LOCK_REASON.pending,
  running: RESOLVER_LOCK_REASON.running,
  resolved: RESOLVER_LOCK_REASON.resolved,
};

export const resolverActGate = ({
  status,
}: {
  readonly status: ResolverStatus;
}): ResolverActGate => {
  const reason = AGENT_REASON[status] ?? null;
  return { canAct: reason === null, reason };
};

export const resolverThreadActGate = ({
  agentReason,
  isQueued,
  isBusy,
}: {
  readonly agentReason: string | null;
  readonly isQueued: boolean;
  readonly isBusy: boolean;
}): ResolverActGate => {
  const reason =
    agentReason ??
    (isQueued ? RESOLVER_LOCK_REASON.batched : isBusy ? RESOLVER_LOCK_REASON.busy : null);
  return { canAct: reason === null, reason };
};
