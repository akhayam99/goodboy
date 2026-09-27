import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { replyVoiceOf } from '../../../../store/sessionReplySettings';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { groupThreads } from '../../../github/comment-threads';
import { kindRouting } from '../../../session/agent-kind';
import { startFixAttempt } from '../../../review/startFixAttempt';
import { conversationSourceOf } from '../../notes/conversationSource';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';

type Params = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<ResolveQueueRow>;
};

export type ResolveAgainParams = {
  readonly threadId: string;
  readonly instruction: string;
};

export const useResolveAgain = ({
  sessionId,
  rows,
}: Params): ((params: ResolveAgainParams) => Promise<boolean>) => {
  const pr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const comments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const setAgentConfig = useAppStore((s) => s.setAgentConfig);
  const reportError = useAppStore((s) => s.reportError);
  const replyVoice = useAppStore(useShallow((s) => replyVoiceOf({ state: s, sessionId })));
  const roleModels = useSessionRoleModels({ sessionId });

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
    async ({ threadId, instruction }: ResolveAgainParams): Promise<boolean> => {
      const row = rows.find((candidate) => candidate.thread.threadId === threadId) ?? null;
      const isNote = row !== null && conversationSourceOf({ row }) === 'note';
      const thread = threadsByThreadId.get(threadId) ?? (isNote ? row.commentThread : null);
      if ((pr === null && !isNote) || thread == null) {
        return false;
      }
      const routing = kindRouting({ kind: 'resolver', roleModels });
      try {
        await startFixAttempt({
          sessionId,
          threads: [thread],
          pr,
          choice: {
            provider: routing.provider,
            model: routing.model,
            ...(routing.effort !== undefined &&
              routing.effort !== null && { effort: routing.effort }),
          },
          instructions: instruction,
          mode: 'retry',
          priorContext: [
            {
              threadId,
              reply: row?.thread.replyDraft ?? null,
              ...(row?.thread.commitShas != null && { commitShas: row.thread.commitShas }),
              intent: 'retry',
            },
          ],
          style: replyVoice,
          spawnAgent,
          setAgentConfig,
        });
        return true;
      } catch (error) {
        void reportError({ title: "Couldn't retry the fix", error, sessionId });
        return false;
      }
    },
    [
      pr,
      replyVoice,
      reportError,
      roleModels,
      rows,
      sessionId,
      setAgentConfig,
      spawnAgent,
      threadsByThreadId,
    ],
  );
};
