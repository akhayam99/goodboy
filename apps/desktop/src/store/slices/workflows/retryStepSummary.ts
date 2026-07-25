import { resolveTaskModel } from '@goodboy/core';
import { fallbackStepOutputSummary } from '@goodboy/core';
import type { AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { summarizeAgentOutput } from '../../summarizeAgentOutput';
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
    const assistantText =
      assistantDeltas.length > 0
        ? assistantDeltas.join('')
        : fallbackStepOutputSummary({ output: '' });

    const taskModel =
      taskModelOverride ??
      resolveTaskModel(
        'summarizer',
        get().workspaceOverrides?.[session.workspaceId]?.taskModels,
        session.providerPreference.defaultProvider,
      );

    const worktreePath = get().sessionWorktrees?.[sessionId]?.[0] ?? null;
    const result = await summarizeAgentOutput({
      output: assistantText,
      taskModel,
      ...(worktreePath != null && { workingDir: worktreePath }),
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
