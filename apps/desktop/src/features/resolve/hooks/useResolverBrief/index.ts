import { useMemo } from 'react';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';

export type ResolverBrief = {
  readonly attempt: ResolveAttempt;
  readonly threadId: string;
  readonly ownThreadIds: ReadonlyArray<string>;
  readonly batchThreadIds: ReadonlyArray<string>;
  readonly isBatch: boolean;
};

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const resolverBriefOf = ({
  attempts,
  agentId,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly agentId: AgentId;
}): ResolverBrief | null => {
  const attempt = attempts.find((candidate) => candidate.agentId === agentId) ?? null;
  const threadId = attempt?.threadIds[0] ?? null;
  if (attempt === null || threadId === null) {
    return null;
  }
  const siblings =
    attempt.batchId === null
      ? [attempt]
      : attempts.filter((candidate) => candidate.batchId === attempt.batchId);
  const batchThreadIds = [
    ...new Set([...attempt.threadIds, ...siblings.flatMap((sibling) => sibling.threadIds)]),
  ];
  return {
    attempt,
    threadId,
    ownThreadIds: attempt.threadIds,
    batchThreadIds,
    isBatch: batchThreadIds.length > 1,
  };
};

export const useResolverBrief = ({ sessionId, agentId }: Params): ResolverBrief | null => {
  const attempts = useAppStore(
    (state) =>
      state.sessionResolveAttempts?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<ResolveAttempt>),
  );
  return useMemo(() => resolverBriefOf({ attempts, agentId }), [attempts, agentId]);
};
