import { resolveTaskModel } from '@goodboy/core';
import { fallbackStepOutputSummary } from '@goodboy/core';
import type { AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { routeTaskModel } from '../../../features/providers/taskModelRouting';
import { stepForAgent } from '../../../features/workflows/stepForAgent';
import { summarizeAgentOutput } from '../../summarizeAgentOutput';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly taskModelOverride?: TaskModelPreference;
};

export const retryStepSummary = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, taskModelOverride }: Params): Promise<void> => {
    const session = get().sessions.find((s) => s.id === sessionId);
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
        taskModel: resolveTaskModel({
          task: 'summarizer',
          preferences: selectResolvedSettings({ state: get(), sessionId })?.taskModels,
          workspaceDefaultProviderId: selectResolvedSettings({ state: get(), sessionId })
            ?.defaultProviderOverride,
          sessionDefaultProviderId: session.providerPreference.defaultProvider,
        }),
        connectedProviders: get()
          .providers.filter((provider) => provider.connection === 'connected')
          .map((provider) => provider.id),
        enabledProviders: session.providerPreference.enabledProviders ?? null,
        cooldowns: get().providerCooldowns,
        nowMs: Date.now(),
      });

    if (taskModel == null) {
      void get().emitNotification({
        kind: 'summarizer-degraded',
        severity: 'warning',
        title: 'step summary retry unavailable',
        body: 'every summarizer provider is cooling down',
        sessionId,
        action: { kind: 'retry-step-summary', sessionId, agentId },
      });
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
      agentId,
      output: assistantText,
      taskModel,
      ...(worktreePath != null && { workingDir: worktreePath }),
      ...(expectedOutput !== '' && { expectedOutput }),
    });
    if (result.degraded) {
      void get().emitNotification({
        kind: 'summarizer-degraded',
        severity: 'warning',
        title: 'step summary retry failed',
        body: result.error ?? 'summarization failed',
        sessionId,
        action: { kind: 'retry-step-summary', sessionId, agentId },
      });
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
