import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { launchChoiceOf } from '../../launchChoice';
import { startBatch } from '../../startBatch';

type Params = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<ResolveQueueRow>;
};

export type ResolveAgainOutcome = 'started' | 'missing' | 'failed';

export type ResolveAgainParams = {
  readonly threadId: string;
  readonly instruction: string;
};

export const useResolveAgain = ({
  sessionId,
  rows,
}: Params): ((params: ResolveAgainParams) => Promise<ResolveAgainOutcome>) => {
  const continueResolveThreads = useAppStore((s) => s.continueResolveThreads);
  const reportError = useAppStore((s) => s.reportError);
  const picked = useAppStore((s) => s.resolveQueueView[sessionId]?.lastRouting ?? null);

  return useCallback(
    async ({ threadId, instruction }: ResolveAgainParams): Promise<ResolveAgainOutcome> => {
      const row = rows.find((candidate) => candidate.thread.threadId === threadId) ?? null;
      if (row === null || row.attempt === null || row.commentThread === null) {
        return 'missing';
      }
      try {
        if (picked !== null && picked.model !== row.attempt.model) {
          await startBatch({
            getState: useAppStore.getState,
            sessionId,
            threadIds: [threadId],
            launchChoice: launchChoiceOf({ routing: picked, commitStyle: null, hint: instruction }),
          });
          return 'started';
        }
        await continueResolveThreads({ sessionId, threadIds: [threadId], hint: instruction });
        return 'started';
      } catch (error) {
        void reportError({ title: "Couldn't retry the fix", error, sessionId });
        return 'failed';
      }
    },
    [continueResolveThreads, picked, reportError, rows, sessionId],
  );
};
