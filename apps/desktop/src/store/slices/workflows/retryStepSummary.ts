import { resolveTaskModel } from '@goodboy/core';
import { fallbackStepOutputSummary } from '@goodboy/core';
import type { AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { stepForAgent } from '../../../features/workflows/stepForAgent';
import { summarizeAgentOutput, summarizedStepOutputs } from '../../summarizeAgentOutput';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn, SetFn } from './types';

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
    const assistantText = summarizedStepOutputs.get(agentId) ?? transcriptText;

    const taskModel =
      taskModelOverride ??
      resolveTaskModel(
        'summarizer',
        get().workspaceOverrides?.[session.workspaceId]?.taskModels,
        session.providerPreference.defaultProvider,
      );

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
      agentId,
      output: assistantText,
      taskModel,
      ...(worktreePath != null && { workingDir: worktreePath }),
      ...(expectedOutput !== '' && { expectedOutput }),
    });
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
