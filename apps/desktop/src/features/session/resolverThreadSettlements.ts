import type { PendingResolution } from '@goodboy/types';
import type { ResolverThreadOutcome } from '../../store/types';

export type ResolverThreadSettlementKind = 'resolved' | 'wontfix' | 'analyzed' | 'open';

export type ResolverThreadSettlement = {
  readonly threadId: string;
  readonly kind: ResolverThreadSettlementKind;
  readonly commitSha: string | null;
  readonly reason: string | null;
  readonly reply: string | null;
  readonly isQueued: boolean;
  readonly isClosed: boolean;
};

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly pendingResolutions: ReadonlyArray<PendingResolution>;
  readonly closedThreadIds: ReadonlySet<string>;
};

const trimmed = (value: string | null | undefined): string | null => {
  const text = value?.trim() ?? '';
  return text === '' ? null : text;
};

const fromOutcome = ({
  threadId,
  outcome,
  isQueued,
  isClosed,
}: {
  readonly threadId: string;
  readonly outcome: ResolverThreadOutcome;
  readonly isQueued: boolean;
  readonly isClosed: boolean;
}): ResolverThreadSettlement => {
  if (outcome.kind === 'resolved') {
    return {
      threadId,
      kind: 'resolved',
      commitSha: outcome.commitSha,
      reason: null,
      reply: trimmed(outcome.reply),
      isQueued,
      isClosed,
    };
  }
  if (outcome.kind === 'wontfix') {
    return {
      threadId,
      kind: 'wontfix',
      commitSha: null,
      reason: trimmed(outcome.reason),
      reply: trimmed(outcome.reply),
      isQueued,
      isClosed,
    };
  }
  return {
    threadId,
    kind: 'analyzed',
    commitSha: null,
    reason: null,
    reply: trimmed(outcome.reply),
    isQueued,
    isClosed,
  };
};

const fromPending = ({
  threadId,
  resolution,
  isClosed,
}: {
  readonly threadId: string;
  readonly resolution: PendingResolution;
  readonly isClosed: boolean;
}): ResolverThreadSettlement => {
  const kind: ResolverThreadSettlementKind = resolution.outcome ?? 'open';
  return {
    threadId,
    kind,
    commitSha: kind === 'resolved' ? resolution.commitSha : null,
    reason: null,
    reply: trimmed(resolution.reply),
    isQueued: true,
    isClosed,
  };
};

export const resolverThreadSettlements = ({
  threadIds,
  outcomes,
  pendingResolutions,
  closedThreadIds,
}: Params): ReadonlyArray<ResolverThreadSettlement> => {
  const keys = threadIds.length > 0 ? threadIds : Object.keys(outcomes);
  return keys.map((threadId) => {
    const resolution = pendingResolutions.find((row) => row.threadId === threadId);
    const outcome = outcomes[threadId];
    const isClosed = closedThreadIds.has(threadId);
    if (outcome !== undefined) {
      return fromOutcome({ threadId, outcome, isQueued: resolution !== undefined, isClosed });
    }
    if (resolution !== undefined) {
      return fromPending({ threadId, resolution, isClosed });
    }
    return {
      threadId,
      kind: 'open',
      commitSha: null,
      reason: null,
      reply: null,
      isQueued: false,
      isClosed,
    };
  });
};
