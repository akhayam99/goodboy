import type { Agent, IsoDateTime, SessionId, WorkflowId } from '@goodboy/types';
import {
  attachWorkflowToSession as attachWorkflowToSessionInDb,
  updateSessionAutoRun,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentInsert } from '../../../features/workflows/workflows';
import {
  AGENT_KIND_DEFAULTS,
  ROLE_TO_KIND,
  inferAgentKindFromName,
} from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';

interface Options {
  autoRun?: boolean;
}

export function attachWorkflowToSession(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, workflowId: WorkflowId, options?: Options) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.workflowIds.includes(workflowId)) {
      throw new Error('workflow already attached to this session');
    }

    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = templates.find((t) => t.id === workflowId);
    if (!template) throw new Error(`workflow not found: ${workflowId}`);

    const autoRun = options?.autoRun === true;
    const now = new Date().toISOString() as IsoDateTime;
    await attachWorkflowToSessionInDb(tauriDatabase, sessionId, workflowId, now);
    if (autoRun !== session.autoRun) {
      await updateSessionAutoRun(tauriDatabase, sessionId, autoRun, now);
    }

    const existingRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const baseOrdinal = existingRuns.reduce((max, r) => Math.max(max, r.ordinal), -1);
    const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
    const newAgents: Agent[] = [];
    const agentModelOverrides: Record<string, string> = {};
    const agentKindOverrides: Record<string, string> = {};
    for (let i = 0; i < sortedSteps.length; i += 1) {
      const step = sortedSteps[i]!;
      const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
      const agent = await invokeAgentInsert({
        sessionId,
        stepId: step.id,
        ordinal: baseOrdinal + 1 + i,
        name: step.name,
        status: 'pending',
        kind,
      });
      agentModelOverrides[agent.id] = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
      agentKindOverrides[agent.id] = kind;
      newAgents.push(agent);
    }

    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of newAgents) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              workflowIds: [...s.workflowIds, workflowId],
              currentStepByWorkflow: { ...s.currentStepByWorkflow, [workflowId]: 0 },
              autoRun,
              updatedAt: now,
            }
          : s,
      ),
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [sessionId]: [...(state.sessionWorkflows[sessionId] ?? []), template],
      },
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: [...existingRuns, ...newAgents],
      },
      transcripts: { ...state.transcripts, ...transcriptEntries },
      agentTurnState: { ...state.agentTurnState, ...turnStateEntries },
      agentModelOverride: { ...state.agentModelOverride, ...agentModelOverrides },
      agentKindOverride: { ...state.agentKindOverride, ...agentKindOverrides },
    }));

    void get().reprocessGoalForWorkflow(sessionId);

    if (autoRun) void get().maybeAutoAdvanceWorkflow(sessionId);
  };
}
