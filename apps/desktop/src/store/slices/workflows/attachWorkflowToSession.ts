import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  ProviderId,
  SessionId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkflowTriggerMode,
} from '@goodboy/types';
import { attachWorkflowToSession as attachWorkflowToSessionInDb } from '@goodboy/db';
import {
  isWorkflowComplete,
  recommendedModelForRole,
  resolveModelForProvider,
  runsForWorkflowRun,
} from '@goodboy/core';
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
  goal?: string;
  triggerMode?: WorkflowTriggerMode;
  chainAfterId?: WorkflowRunId;
  attachmentInputs?: ReadonlyArray<AttachmentInput>;
};

export const attachWorkflowToSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowId: WorkflowId, options?: Options) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = templates.find((t) => t.id === workflowId);
    if (!template) {
      throw new Error(`workflow not found: ${workflowId}`);
    }

    const workflowRunId = crypto.randomUUID() as WorkflowRunId;
    const autoRun = options?.autoRun ?? session.autoRun;
    const goal = options?.goal?.trim() || undefined;
    const chainAfterId = options?.chainAfterId;
    let triggerMode: WorkflowTriggerMode = options?.triggerMode ?? 'immediate';
    if (triggerMode === 'after_run' && chainAfterId) {
      const predecessor = session.workflowRuns.find((r) => r.id === chainAfterId);
      const predTemplate = predecessor
        ? templates.find((t) => t.id === predecessor.workflowId)
        : undefined;
      if (predecessor && !predecessor.discardedAt && predTemplate) {
        const predAgents = runsForWorkflowRun(
          get().sessionPhaseRuns[sessionId] ?? [],
          chainAfterId,
        );
        if (isWorkflowComplete(predTemplate, predAgents)) {
          triggerMode = 'immediate';
        }
      }
    }
    const ordinal = session.workflowRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
    const now = new Date().toISOString() as IsoDateTime;
    await attachWorkflowToSessionInDb(
      tauriDatabase,
      sessionId,
      workflowRunId,
      workflowId,
      autoRun,
      now,
      goal,
      triggerMode,
      chainAfterId,
    );

    const existingRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const baseOrdinal = existingRuns.reduce((max, r) => Math.max(max, r.ordinal), -1);
    const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
    const sessionDefaultProvider = (session.providerOverride ??
      session.providerPreference.defaultProvider) as ProviderId;
    const newAgents: Agent[] = [];
    const agentModelOverrides: Record<string, string> = {};
    const agentKindOverrides: Record<string, string> = {};
    const agentProviderOverrides: Record<string, ProviderId> = {};
    const agentEffortOverrides: Record<string, string> = {};
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
      const resolvedProvider = step.providerOverride ?? sessionDefaultProvider;
      agentProviderOverrides[agent.id] = resolvedProvider;
      agentModelOverrides[agent.id] = resolveModelForProvider({
        provider: resolvedProvider,
        modelId:
          step.modelOverride ??
          recommendedModelForRole({ role: step.role ?? 'custom', provider: resolvedProvider }),
      });
      agentKindOverrides[agent.id] = kind;
      if (step.effort) {
        agentEffortOverrides[agent.id] = step.effort;
      }
      newAgents.push(agent);
    }

    const newRun: WorkflowRun = {
      id: workflowRunId,
      workflowId,
      ordinal,
      currentStep: 0,
      autoRun,
      triggerMode,
      ...(chainAfterId && { chainAfterId }),
      ...(goal && { goal }),
    };

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
      agentProviderOverride: { ...state.agentProviderOverride, ...agentProviderOverrides },
      agentEffortOverride: { ...state.agentEffortOverride, ...agentEffortOverrides },
    }));

    const attachmentInputs = options?.attachmentInputs;
    if (attachmentInputs && attachmentInputs.length > 0) {
      await get().addGoalAttachments({ type: 'workflow_run', id: workflowRunId }, attachmentInputs);
    }

    void get().reprocessGoalForWorkflow(sessionId);

    if (triggerMode === 'immediate') {
      if (autoRun) {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      } else if (newAgents.length > 0) {
        void get().activateWorkflowAgent(sessionId, newAgents[0]!.id);
      }
    }
  };
};
