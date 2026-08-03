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
};

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly pendingResolutions: ReadonlyArray<PendingResolution>;
};

const trimmed = (value: string | null | undefined): string | null => {
  const text = value?.trim() ?? '';
  return text === '' ? null : text;
};

const fromOutcome = ({
  threadId,
  outcome,
  isQueued,
}: {
  readonly threadId: string;
  readonly outcome: ResolverThreadOutcome;
  readonly isQueued: boolean;
}): ResolverThreadSettlement => {
  if (outcome.kind === 'resolved') {
    return {
      threadId,
      kind: 'resolved',
      commitSha: outcome.commitSha,
      reason: null,
      reply: trimmed(outcome.reply),
      isQueued,
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
    };
  }
  return {
    threadId,
    kind: 'analyzed',
    commitSha: null,
    reason: null,
    reply: trimmed(outcome.reply),
    isQueued,
  };
};

const fromPending = ({
  threadId,
  resolution,
}: {
  readonly threadId: string;
  readonly resolution: PendingResolution;
}): ResolverThreadSettlement => {
  const kind = resolution.outcome ?? 'resolved';
  return {
    threadId,
    kind,
    commitSha: kind === 'resolved' ? resolution.commitSha : null,
    reason: null,
    reply: trimmed(resolution.reply),
    isQueued: true,
  };
};

export const resolverThreadSettlements = ({
  threadIds,
  outcomes,
  pendingResolutions,
}: Params): ReadonlyArray<ResolverThreadSettlement> => {
  const keys = threadIds.length > 0 ? threadIds : Object.keys(outcomes);
  return keys.map((threadId) => {
    const resolution = pendingResolutions.find((row) => row.threadId === threadId);
    const outcome = outcomes[threadId];
    if (outcome !== undefined) {
      return fromOutcome({ threadId, outcome, isQueued: resolution !== undefined });
    }
    if (resolution !== undefined) {
      return fromPending({ threadId, resolution });
    }
    return {
      threadId,
      kind: 'open',
      commitSha: null,
      reason: null,
      reply: null,
      isQueued: false,
    };
  });
};
