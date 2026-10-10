import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { fallbackStepOutputSummary } from '@goodboy/core';
import type { AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { routeTaskModel } from '../../../features/providers/taskModelRouting';
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
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly taskModelOverride?: TaskModelPreference;
};

const retryOneStepSummary = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, taskModelOverride }: Params): Promise<void> => {
    const session = sessionById(get().sessions, sessionId);
    const agents = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = agents.find((a) => a.id === agentId);

    if (session == null || agent == null) {
      return;
    }

    const transcriptEvents = get().transcripts[agentId] ?? [];
    const assistantDeltas = transcriptEvents
      .filter((e) => e.kind === 'assistant_text')
      .map((e) => (e.kind === 'assistant_text' ? e.delta : ''));
    const transcriptText =
      assistantDeltas.length > 0
        ? assistantDeltas.join('')
        : fallbackStepOutputSummary({ output: '' });
    const assistantText = get().degradedStepOutputs[agentId] ?? transcriptText;

    const taskModel =
      taskModelOverride ??
      routeTaskModel({
        taskModel: resolveLimitedTaskModel({
          limitContext: autoLimitContext({ state: get() }),
          task: 'summarizer',
          preferences: selectResolvedSettings({ state: get(), sessionId })?.taskModels,
          workspaceDefaultProviderId: selectResolvedSettings({ state: get(), sessionId })
            ?.defaultProviderOverride,
          sessionDefaultProviderId: session.providerPreference.defaultProvider,
        }),
        connectedProviders: autoRoutableProviders({ providers: get().providers }),
        enabledProviders: session.providerPreference.enabledProviders ?? null,
        cooldowns: get().providerCooldowns,
        hidden: selectHiddenModels({ state: get() }),
        nowMs: Date.now(),
      });

    if (taskModel == null) {
      notifyStepSummaryFailed({ get, sessionId, agent, attempts: [] });
      return;
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
      agentId,
      output: assistantText,
      taskModel,
      ...(worktreePath != null && { workingDir: worktreePath }),
      ...(expectedOutput !== '' && { expectedOutput }),
    });
    if (result.degraded) {
      notifyStepSummaryFailed({ get, sessionId, agent, attempts: result.attempts });
      return;
    }
    await invokeAgentUpdateStatus(agentId, { status: 'completed', outputSummary: result.summary });

    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((a) =>
          a.id === agentId ? { ...a, outputSummary: result.summary } : a,
        ),
      },
    }));
  };
};

export const retryStepSummary = (set: SetFn, get: GetFn) => {
  const retryOne = retryOneStepSummary(set, get);
  return async (params: Params): Promise<void> => {
    await retryOne(params);
    const degraded = get().stepSummaryDegraded;
    const siblings = (get().sessionPhaseRuns[params.sessionId] ?? []).filter(
      (candidate) => candidate.id !== params.agentId && degraded[candidate.id] === true,
    );
    for (const sibling of siblings) {
      await retryOne({ sessionId: params.sessionId, agentId: sibling.id });
    }
    resolveStepSummaryNotice({ get, sessionId: params.sessionId });
  };
};
