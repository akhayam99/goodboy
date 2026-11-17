import { useMemo } from 'react';
import type { ResolveAttempt } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { attemptLanePathOf, readyFixBlocking } from '../../../../store/slices/resolve/resolveLane';

type Params = {
  readonly attempt: ResolveAttempt;
};

export const useReadyFixFirst = ({ attempt }: Params): string | null => {
  const sessionId = attempt.sessionId;
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId]);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId]);
  const queue = useAppStore((s) => s.sessionResolveQueueItems[sessionId]);
  return useMemo(() => {
    const worktreePath = attemptLanePathOf({ attempt });
    if (attempt.phase !== 'queued' || worktreePath === null || candidates === undefined) {
      return null;
    }
    const blocker = readyFixBlocking({
      candidates,
      attempts: attempts ?? [],
      worktreePath,
      threadIds: attempt.threadIds,
    });
    const itemId = candidates.find((entry) => entry.candidate.id === blocker?.id)?.items[0]
      ?.queueItemId;
    return queue?.find((entry) => entry.item.id === itemId)?.thread.threadId ?? null;
  }, [attempt, attempts, candidates, queue]);
};
