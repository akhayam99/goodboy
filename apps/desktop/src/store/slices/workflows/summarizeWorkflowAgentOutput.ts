import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { fallbackStepOutputSummary } from '@goodboy/core';
import type { Agent, AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import { routeTaskModel } from '../../../features/providers/taskModelRouting';
import { modelLabel } from '../../../features/chat/utils/chat-constants';
import { stepForAgent } from '../../../features/workflows/stepForAgent';
import { summarizeAgentOutput } from './summarizeAgentOutput';
import { notifyStepSummaryFailed, resolveStepSummaryNotice } from './stepSummaryNotice';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { sessionById } from '../sessions/sessionIndex';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import { selectHiddenModels } from '../settings/selectHiddenModels';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly output: string;
};

type UnavailableParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly unavailable: TaskModelPreference;
  readonly replacement: TaskModelPreference | null;
};

const modelLabelFor = (taskModel: TaskModelPreference): string =>
  `${taskModel.providerId}/${modelLabel(taskModel.model, taskModel.providerId)}`;

const notifyModelUnavailable = ({
  get,
  sessionId,
  agent,
  unavailable,
  replacement,
}: UnavailableParams): void => {
  const label = modelLabelFor(unavailable);
  const outcome =
    replacement === null
      ? 'no other provider could take over, so the step output was carried unsummarized'
      : `${modelLabelFor(replacement)} summarized this step instead`;
  void get().emitNotification({
    kind: 'summarizer-degraded',
    severity: 'warning',
    title: `Summarizer model ${label} is unavailable`,
    body: `${label} is not available to this account and ${outcome}. change the summarizer model in Providers then Models.`,
    sessionId,
    action: { kind: 'retry-step-summary', sessionId, agentId: agent.id as AgentId },
    coalesceKey: `summarizer-model-unavailable:${unavailable.providerId}:${unavailable.model}`,
  });
};

export const summarizeWorkflowAgentOutput = async ({
  set,
  get,
  sessionId,
  agent,
  output,
}: Params): Promise<string> => {
  const session = sessionById(get().sessions, sessionId);
  if (session == null) {
    return fallbackStepOutputSummary({ output });
  }
  const connectedProviders = autoRoutableProviders({ providers: get().providers });
  const enabledProviders = session.providerPreference.enabledProviders ?? null;
  const resolved = resolveLimitedTaskModel({
    limitContext: autoLimitContext({ state: get() }),
    task: 'summarizer',
    preferences: selectResolvedSettings({ state: get(), sessionId })?.taskModels,
    workspaceDefaultProviderId: selectResolvedSettings({ state: get(), sessionId })
      ?.defaultProviderOverride,
    sessionDefaultProviderId: session.providerPreference.defaultProvider,
  });
  const taskModel = routeTaskModel({
    taskModel: resolved,
    connectedProviders,
    enabledProviders,
    cooldowns: get().providerCooldowns,
    hidden: selectHiddenModels({ state: get() }),
    nowMs: Date.now(),
  });
  if (taskModel === null) {
    notifyStepSummaryFailed({ get, sessionId, agent, attempts: [] });
    return fallbackStepOutputSummary({ output });
  }
  const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
  const expectedOutput =
    stepForAgent({
      agent,
      workflowRuns: session.workflowRuns,
      workflows: [
        ...(get().phaseTemplates?.[session.workspaceId] ?? []),
        ...(get().sessionWorkflows?.[sessionId] ?? []),
      ],
    })?.expectedOutput ?? '';
  const result = await summarizeAgentOutput({
    set,
    get,
    sessionId,
    agentId: agent.id,
    output,
    taskModel,
    ...(worktreePath != null && { workingDir: worktreePath }),
    ...(expectedOutput !== '' && { expectedOutput }),
  });
  const firstAttempt = result.attempts[0];
  if (firstAttempt?.failure === 'model_not_available') {
    notifyModelUnavailable({
      get,
      sessionId,
      agent,
      unavailable: firstAttempt.model,
      replacement: result.degraded ? null : result.model,
    });
    if (!result.degraded) {
      resolveStepSummaryNotice({ get, sessionId });
    }
    return result.summary;
  }
  if (result.degraded) {
    notifyStepSummaryFailed({ get, sessionId, agent, attempts: result.attempts });
    return result.summary;
  }
  resolveStepSummaryNotice({ get, sessionId });
  return result.summary;
};
