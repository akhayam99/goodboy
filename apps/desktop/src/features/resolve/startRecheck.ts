import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';
import { autoLimitContext } from '../../store/slices/providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../../store/slices/providerLimits/resolveLimitedTaskModel';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { buildRecheckAgentArgs } from '../chat/spawn-from-comment';
import { recheckParentOf } from './recheckParentOf';
import { reviewRowsOf } from './reviewRows';

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const NOTHING_TO_RECHECK = 'This comment is no longer on the pull request';

type RecheckModelParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const recheckModelOf = ({ state, sessionId }: RecheckModelParams) => {
  const settings = selectResolvedSettings({ state, sessionId });
  return resolveLimitedTaskModel({
    limitContext: autoLimitContext({ state }),
    task: 'recheck',
    preferences: settings?.taskModels,
    workspaceDefaultProviderId: settings?.defaultProviderOverride,
    sessionDefaultProviderId:
      sessionById(state.sessions, sessionId)?.providerPreference.defaultProvider ?? 'anthropic',
  });
};

export const startRecheck = async ({
  getState,
  sessionId,
  threadId,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const state = getState();
  const row = reviewRowsOf({ state, sessionId }).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  if (row === undefined || row.commentThread === null) {
    throw new Error(NOTHING_TO_RECHECK);
  }
  const taskModel = recheckModelOf({ state, sessionId });
  const shas = row.thread.commitShas ?? [];
  const parentAgentId = recheckParentOf({
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    threadId,
  });
  const args = buildRecheckAgentArgs({
    thread: row.commentThread,
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    priorContext: [
      {
        threadId,
        ...(shas.length > 0 && { commitShas: shas }),
        intent: 'recheck',
      },
    ],
  });
  const agentId = await state.spawnAgent(sessionId, {
    name: args.name,
    model: taskModel.model,
    provider: taskModel.providerId,
    ...(taskModel.effort != null && { effort: taskModel.effort }),
    initialPrompt: args.initialPrompt,
    humanPrompt: args.humanPrompt,
    kindOverride: 'scout',
    ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
    sourceCommentUrl: args.sourceCommentUrl,
    sourceKind: 'comment_recheck',
    focus: 'none',
    ...(parentAgentId !== null && { parentAgentId }),
  });
  await state.setAgentConfig(sessionId, agentId, {
    providerOverride: taskModel.providerId,
    modelOverride: taskModel.model,
    ...(taskModel.effort != null && { effort: taskModel.effort }),
  });
  return [agentId];
};
