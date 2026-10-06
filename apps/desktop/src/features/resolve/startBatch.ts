import type { AgentId, ResolveLaunchChoice, SessionId } from '@goodboy/types';
import type { LaunchNoun } from './reviewLaunchCopy';
import type { AppStore } from '../../store/store';
import { sessionResolveStyle } from '../../store/sessionReplySettings';
import type { CommentThread } from '../integrations/github/comment-threads';
import { launchRowsOf } from './reviewRows';
import { startResolve } from './startResolve';

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly launchChoice: ResolveLaunchChoice;
  readonly noun?: LaunchNoun;
};

export type StartedBatch = {
  readonly batchId: string;
  readonly launchId: string;
  readonly agentId: AgentId;
};

const NOTHING_TO_DRAFT: Record<LaunchNoun, string> = {
  comment: 'These comments are no longer on the pull request',
  note: 'These notes are no longer open',
};

export const startBatch = async ({
  getState,
  sessionId,
  threadIds,
  launchChoice,
  noun = 'comment',
}: Params): Promise<StartedBatch> => {
  const state = getState();
  const rows = launchRowsOf({ state, sessionId });
  const threads = threadIds.flatMap((threadId): ReadonlyArray<CommentThread> => {
    const commentThread = rows.find((row) => row.thread.threadId === threadId)?.commentThread;
    return commentThread == null ? [] : [commentThread];
  });
  if (threads.length === 0) {
    throw new Error(NOTHING_TO_DRAFT[noun]);
  }
  const batch = await state.createResolveBatch({
    sessionId,
    threadIds: threads.flatMap((thread) =>
      thread.head.threadId == null ? [] : [thread.head.threadId],
    ),
    launchChoice,
  });
  const { launchId, agentId } = await startResolve({
    sessionId,
    threads,
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    batch: { batchId: batch.id, launchChoice },
    style: sessionResolveStyle({ state, sessionId }),
    spawnAgent: state.spawnAgent,
    setAgentConfig: state.setAgentConfig,
  });
  return { batchId: batch.id, launchId, agentId };
};
