import type {
  Agent,
  IsoDateTime,
  SessionId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { attachWorkflowToSession as attachWorkflowToSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentInsert } from '../../../features/workflows/workflows';
import {
  AGENT_KIND_DEFAULTS,
  ROLE_TO_KIND,
  inferAgentKindFromName,
} from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';

type Options = {
  autoRun?: boolean;
};

export const attachWorkflowToSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowId: WorkflowId, options?: Options) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);

    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = templates.find((t) => t.id === workflowId);
    if (!template) throw new Error(`workflow not found: ${workflowId}`);

    const workflowRunId = crypto.randomUUID() as WorkflowRunId;
    const autoRun = options?.autoRun ?? session.autoRun;
    const ordinal = session.workflowRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
    const now = new Date().toISOString() as IsoDateTime;
    await attachWorkflowToSessionInDb(
      tauriDatabase,
      sessionId,
      workflowRunId,
      workflowId,
      autoRun,
      now,
    );

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
        workflowRunId,
        ordinal: baseOrdinal + 1 + i,
        name: step.name,
        status: 'pending',
        kind,
      });
      agentModelOverrides[agent.id] = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
      agentKindOverrides[agent.id] = kind;
      newAgents.push(agent);
    }

    const newRun: WorkflowRun = { id: workflowRunId, workflowId, ordinal, currentStep: 0, autoRun };

    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of newAgents) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, workflowRuns: [...s.workflowRuns, newRun], updatedAt: now }
          : s,
      ),
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [sessionId]: (state.sessionWorkflows[sessionId] ?? []).some((w) => w.id === workflowId)
          ? (state.sessionWorkflows[sessionId] ?? [])
          : [...(state.sessionWorkflows[sessionId] ?? []), template],
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

    if (autoRun) {
      void get().maybeAutoAdvanceWorkflow(sessionId);
    } else if (newAgents.length > 0) {
      void get().activateWorkflowAgent(sessionId, newAgents[0]!.id);
    }
  };
};
