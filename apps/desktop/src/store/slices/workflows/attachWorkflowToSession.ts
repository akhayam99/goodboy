import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  ProviderId,
  SessionId,
  WorkflowId,
  WorkflowExecutionMode,
  WorkflowRun,
  WorkflowRunId,
  WorkflowTriggerMode,
} from '@goodboy/types';
import { attachWorkflowToSession as attachWorkflowToSessionInDb } from '@goodboy/db';
import { isWorkflowComplete, runsForWorkflowRun } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';
import type { GetFn, SetFn } from './types';

type Options = {
  autoRun?: boolean;
  goal?: string;
  triggerMode?: WorkflowTriggerMode;
  chainAfterId?: WorkflowRunId;
  attachmentInputs?: ReadonlyArray<AttachmentInput>;
  executionMode?: WorkflowExecutionMode;
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
    const executionMode = options?.executionMode ?? 'static';
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
        const predecessorComplete =
          predecessor.executionMode === 'dynamic'
            ? predecessor.orchestrationOutcome === 'done'
            : isWorkflowComplete(predTemplate, predAgents);
        if (predecessorComplete) {
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
      executionMode,
    );

    const existingRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const baseOrdinal = existingRuns.reduce((max, r) => Math.max(max, r.ordinal), -1);
    const sessionDefaultProvider = (session.providerOverride ??
      session.providerPreference.defaultProvider) as ProviderId;
    const roleModels = roleModelsForSession({ state: get(), sessionId });
    const spawned =
      executionMode === 'dynamic'
        ? {
            agents: [] as ReadonlyArray<Agent>,
            modelOverrides: {},
            kindOverrides: {},
            providerOverrides: {},
            effortOverrides: {},
          }
        : await preSpawnWorkflowAgents({
            sessionId,
            workflowRunId,
            steps: template.steps,
            baseOrdinal: baseOrdinal + 1,
            defaultProvider: sessionDefaultProvider,
            roleModels,
          });
    const newAgents = spawned.agents;

    const newRun: WorkflowRun = {
      id: workflowRunId,
      workflowId,
      ordinal,
      currentStep: 0,
      autoRun,
      triggerMode,
      executionMode,
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
      agentModelOverride: { ...state.agentModelOverride, ...spawned.modelOverrides },
      agentKindOverride: { ...state.agentKindOverride, ...spawned.kindOverrides },
      agentProviderOverride: { ...state.agentProviderOverride, ...spawned.providerOverrides },
      agentEffortOverride: { ...state.agentEffortOverride, ...spawned.effortOverrides },
    }));

    const attachmentInputs = options?.attachmentInputs;
    if (attachmentInputs && attachmentInputs.length > 0) {
      await get().addGoalAttachments({ type: 'workflow_run', id: workflowRunId }, attachmentInputs);
    }

    void get().reprocessGoalForWorkflow(sessionId);

    if (triggerMode === 'immediate') {
      if (executionMode === 'dynamic' && autoRun) {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      } else if (executionMode === 'dynamic') {
        void get().orchestrateNextStep(sessionId, workflowRunId);
      } else if (autoRun) {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      } else if (newAgents.length > 0) {
        void get().activateWorkflowAgent(sessionId, newAgents[0]!.id);
      }
    }
  };
};
