import type {
  AgentId,
  MountId,
  PrComment,
  PullRequestState,
  ResolveLaunchChoice,
  SessionId,
} from '@goodboy/types';
import type { LaunchNoun } from './reviewLaunchCopy';
import type { AppStore } from '../../store/store';
import { sessionResolveStyle } from '../../store/sessionReplySettings';
import { dropLaunchedSelection } from './dropLaunchedSelection';
import { launchThreadsOf } from './launchThreadsOf';
import { startResolve } from './startResolve';

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly launchChoice: ResolveLaunchChoice;
  readonly comments?: ReadonlyArray<PrComment>;
  readonly mountId?: MountId;
  readonly expectedMountRevision?: number;
  readonly onWrite?: () => void;
  readonly noun?: LaunchNoun;
  readonly name?: string;
  readonly parentAgentId?: AgentId;
};

export type StartedBatch = {
  readonly batchId: string;
  readonly launchId: string;
  readonly agentId: AgentId;
};

type PrParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly mountId?: MountId;
};

const prOf = ({ state, sessionId, mountId }: PrParams): PullRequestState | null =>
  mountId === undefined
    ? (state.sessionGithub[sessionId]?.pr ?? null)
    : (state.mountGithub?.[mountId]?.pr ?? null);

export const startBatch = async ({
  getState,
  sessionId,
  threadIds,
  launchChoice,
  comments,
  mountId,
  expectedMountRevision,
  onWrite,
  noun = 'comment',
  name,
  parentAgentId,
}: Params): Promise<StartedBatch> => {
  const state = getState();
  const threads = launchThreadsOf({
    state,
    sessionId,
    threadIds,
    noun,
    ...(comments !== undefined && { comments }),
  });
  onWrite?.();
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
    pr: prOf({ state, sessionId, ...(mountId !== undefined && { mountId }) }),
    batch: { batchId: batch.id, launchChoice },
    ...(name !== undefined && { name }),
    ...(parentAgentId !== undefined && { parentAgentId }),
    ...(mountId !== undefined && { mountId }),
    ...(expectedMountRevision !== undefined && { expectedMountRevision }),
    style: sessionResolveStyle({ state, sessionId, ...(mountId !== undefined && { mountId }) }),
    spawnAgent: state.spawnAgent,
    setAgentConfig: state.setAgentConfig,
  });
  dropLaunchedSelection({ state: getState(), sessionId, threadIds });
  return { batchId: batch.id, launchId, agentId };
};
