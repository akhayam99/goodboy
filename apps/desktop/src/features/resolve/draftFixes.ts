import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { sessionResolveStyle } from '../../store/sessionReplySettings';
import { selectResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';
import { kindRouting, type AgentKindRouting } from '../session/agent-kind';
import type { CommentThread } from '../github/comment-threads';
import { reviewRowsOf } from './reviewRows';
import { startResolve } from './startResolve';

type RoutingParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const draftRoutingOf = ({ state, sessionId }: RoutingParams): AgentKindRouting =>
  state.resolveQueueView[sessionId]?.lastRouting ??
  kindRouting({
    kind: 'resolver',
    roleModels: selectResolvedSettings({ state, sessionId })?.roleModels ?? null,
  });

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly note?: string;
};

export const NOTHING_TO_DRAFT = 'These comments are no longer on the pull request';

export const draftFixes = async ({
  getState,
  sessionId,
  threadIds,
  note = '',
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const state = getState();
  const wanted = new Set(threadIds);
  const threads = reviewRowsOf({ state, sessionId }).flatMap((row): ReadonlyArray<CommentThread> =>
    wanted.has(row.thread.threadId) && row.commentThread !== null ? [row.commentThread] : [],
  );
  if (threads.length === 0) {
    throw new Error(NOTHING_TO_DRAFT);
  }
  const routing = draftRoutingOf({ state, sessionId });
  return startResolve({
    sessionId,
    threads,
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    routing,
    note,
    style: sessionResolveStyle({ state, sessionId }),
    spawnAgent: state.spawnAgent,
    setAgentConfig: state.setAgentConfig,
  });
};
