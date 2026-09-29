import { useCallback, useMemo } from 'react';
import type { PrComment, ResolveAttempt, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { sessionResolveStyle } from '../../../../store/sessionReplySettings';
import { groupThreads } from '../../../github/comment-threads';
import { conversationSourceOf } from '../../notes/conversationSource';
import { draftRoutingOf } from '../../draftFixes';
import { retryBatchOf } from '../../launchChoice';
import { startResolve } from '../../startResolve';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';

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
  const pr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const comments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const attempts = useAppStore(
    (s) => s.sessionResolveAttempts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<ResolveAttempt>),
  );
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const setAgentConfig = useAppStore((s) => s.setAgentConfig);
  const reportError = useAppStore((s) => s.reportError);

  const threadsByThreadId = useMemo(
    () =>
      new Map(
        groupThreads(comments.filter((comment) => comment.source === 'review')).flatMap((thread) =>
          thread.head.threadId == null ? [] : [[thread.head.threadId, thread] as const],
        ),
      ),
    [comments],
  );

  return useCallback(
    async ({ threadId, instruction }: ResolveAgainParams): Promise<ResolveAgainOutcome> => {
      const row = rows.find((candidate) => candidate.thread.threadId === threadId) ?? null;
      const isNote = row !== null && conversationSourceOf({ row }) === 'note';
      const thread = threadsByThreadId.get(threadId) ?? (isNote ? row.commentThread : null);
      if ((pr === null && !isNote) || thread == null) {
        return 'missing';
      }
      const state = useAppStore.getState();
      try {
        await startResolve({
          sessionId,
          threads: [thread],
          pr,
          routing: draftRoutingOf({ state, sessionId, threadId }),
          note: instruction,
          mode: 'retry',
          priorContext: [
            {
              threadId,
              reply: row?.thread.replyDraft ?? null,
              ...(row?.thread.commitShas != null && { commitShas: row.thread.commitShas }),
              intent: 'retry',
            },
          ],
          style: sessionResolveStyle({ state, sessionId }),
          batch: retryBatchOf({ attempts, threadId }),
          spawnAgent,
          setAgentConfig,
        });
        return 'started';
      } catch (error) {
        void reportError({ title: "Couldn't retry the fix", error, sessionId });
        return 'failed';
      }
    },
    [attempts, pr, reportError, rows, sessionId, setAgentConfig, spawnAgent, threadsByThreadId],
  );
};
