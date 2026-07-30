import { invoke } from '@tauri-apps/api/core';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  Step,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import { OrchestratorClient, resolveTaskModel, runsForWorkflowRun } from '@goodboy/core';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { tauriDatabase } from '../../../shared/lib/db';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';
import { orchestrationTerminalStates } from './orchestrationTerminalStates';
import type { GetFn, SetFn } from './types';

const orchestrationInFlight = new Set<WorkflowRunId>();

type EmitParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly action: 'next' | 'done' | 'blocked';
  readonly reason: string;
  readonly stepName?: string;
  readonly preferredAgentId?: AgentId;
};

const emitDecision = ({
  get,
  sessionId,
  workflowRunId,
  action,
  reason,
  stepName,
  preferredAgentId,
}: EmitParams): void => {
  const runAgents = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId);
  const agentId =
    preferredAgentId ??
    get().selectedAgentId[sessionId] ??
    [...runAgents].sort((left, right) => right.ordinal - left.ordinal)[0]?.id;
  if (agentId == null) {
    return;
  }
  const event: TurnEvent = {
    kind: 'orchestrator_decision',
    runId: 'orchestrator' as ProviderRunId,
    action,
    reason,
    ...(stepName != null && { stepName }),
    at: new Date().toISOString() as IsoDateTime,
  };
  get().appendTurnEvent(agentId, sessionId, event);
};

type UniqueNameParams = {
  readonly requested: string;
  readonly steps: ReadonlyArray<Step>;
};

const uniqueStepName = ({ requested, steps }: UniqueNameParams): string => {
  const names = new Set(steps.map((step) => step.name));
  if (!names.has(requested)) {
    return requested;
  }
  let suffix = 2;
  while (names.has(`${requested} ${suffix}`)) {
    suffix += 1;
  }
  return `${requested} ${suffix}`;
};

type AppendParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflow: Workflow;
  readonly step: Omit<Step, 'id' | 'workflowId' | 'ordinal' | 'name'> & {
    readonly name: string;
  };
};

const appendStep = async ({
  set,
  get,
  sessionId,
  workflowRunId,
  workflow,
  step,
}: AppendParams): Promise<Agent> => {
  const ordinal = workflow.steps.reduce((max, current) => Math.max(max, current.ordinal), -1) + 1;
  const nextStep: Step = {
    id: `step_orchestrator_${crypto.randomUUID()}` as StepId,
    workflowId: workflow.id,
    ordinal,
    name: uniqueStepName({ requested: step.name, steps: workflow.steps }),
    role: step.role,
    promptPrefix: step.promptPrefix,
    expectedOutput: step.expectedOutput,
  };
  const saved = await invokeWorkflowUpsert({
    id: workflow.id,
    workspaceId: workflow.workspaceId,
    name: workflow.name,
    description: workflow.description,
    ...(workflow.goal != null && { goal: workflow.goal }),
    ...(workflow.processText != null && { processText: workflow.processText }),
    steps: [...workflow.steps, nextStep],
    isPreset: workflow.isPreset,
  });
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  if (session == null) {
    throw new Error(`session not found: ${sessionId}`);
  }
  const existingAgents = get().sessionPhaseRuns[sessionId] ?? [];
  const baseOrdinal =
    existingAgents.reduce((max, current) => Math.max(max, current.ordinal), -1) + 1;
  const spawned = await preSpawnWorkflowAgents({
    sessionId,
    workflowRunId,
    steps: [nextStep],
    baseOrdinal,
    defaultProvider: (session.providerOverride ??
      session.providerPreference.defaultProvider) as ProviderId,
    roleModels: roleModelsForSession({ state: get(), sessionId }),
  });
  const agent = spawned.agents[0];
  if (agent == null) {
    throw new Error('orchestrator failed to create the next agent');
  }
  set((state) => ({
    phaseTemplates: {
      ...state.phaseTemplates,
      [workflow.workspaceId]: (state.phaseTemplates[workflow.workspaceId] ?? []).map((current) =>
        current.id === workflow.id ? saved : current,
      ),
    },
    sessionWorkflows: {
      ...state.sessionWorkflows,
      [sessionId]: (state.sessionWorkflows[sessionId] ?? []).map((current) =>
        current.id === workflow.id ? saved : current,
      ),
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [...(state.sessionPhaseRuns[sessionId] ?? []), agent],
    },
    transcripts: { ...state.transcripts, [agent.id]: [] },
    agentTurnState: {
      ...state.agentTurnState,
      [agent.id]: { kind: 'draft' as const },
    },
    agentModelOverride: { ...state.agentModelOverride, ...spawned.modelOverrides },
    agentKindOverride: { ...state.agentKindOverride, ...spawned.kindOverrides },
    agentProviderOverride: { ...state.agentProviderOverride, ...spawned.providerOverrides },
    agentEffortOverride: { ...state.agentEffortOverride, ...spawned.effortOverrides },
  }));
  return agent;
};

export const orchestrateNextStep = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    if (
      orchestrationInFlight.has(workflowRunId) ||
      orchestrationTerminalStates.has(workflowRunId)
    ) {
      return;
    }
    orchestrationInFlight.add(workflowRunId);
    try {
      const session = get().sessions.find((candidate) => candidate.id === sessionId);
      const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
      if (
        session == null ||
        run == null ||
        run.executionMode !== 'dynamic' ||
        run.discardedAt != null
      ) {
        return;
      }
      const workflow = (get().phaseTemplates[session.workspaceId] ?? []).find(
        (candidate) => candidate.id === run.workflowId,
      );
      if (workflow == null) {
        return;
      }
      const agents = [
        ...runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId),
      ].sort((left, right) => left.ordinal - right.ordinal);
      const completedSteps = agents
        .filter((agent) => agent.status === 'completed' || agent.status === 'skipped')
        .map((agent) => ({
          name: agent.name,
          ...(agent.outputSummary != null && { outputSummary: agent.outputSummary }),
        }));
      const openQuestions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
      const taskModel = resolveTaskModel(
        'workflow_orchestrator',
        get().workspaceOverrides?.[session.workspaceId]?.taskModels,
        (session.providerOverride ?? session.providerPreference.defaultProvider) as ProviderId,
      );
      const client = new OrchestratorClient({
        ...taskModel,
        invokeFn: invoke,
        ...(get().sessionWorktrees?.[sessionId]?.[0] != null && {
          workingDir: get().sessionWorktrees[sessionId]![0],
        }),
      });
      const result = await client.decide({
        goal: run.goal ?? workflow.goal ?? session.goal,
        processText: workflow.processText ?? '',
        completedSteps,
        openQuestionCount: openQuestions.length,
      });
      const decision = result.decision ?? {
        action: 'blocked' as const,
        reason: 'unparseable decision',
      };
      if (decision.action === 'next') {
        const agent = await appendStep({
          set,
          get,
          sessionId,
          workflowRunId,
          workflow,
          step: decision.step,
        });
        emitDecision({
          get,
          sessionId,
          workflowRunId,
          action: decision.action,
          reason: decision.reason,
          stepName: agent.name,
          preferredAgentId: agent.id,
        });
        await get().activateWorkflowAgent(sessionId, agent.id);
        return;
      }
      orchestrationTerminalStates.set(workflowRunId, decision.action);
      emitDecision({
        get,
        sessionId,
        workflowRunId,
        action: decision.action,
        reason: decision.reason,
      });
      if (decision.action === 'done') {
        void get().emitNotification(
          'agent-auto-spawn',
          'success',
          'dynamic workflow complete',
          decision.reason,
          { sessionId },
        );
        return;
      }
      void get().emitNotification('error', 'warning', 'dynamic workflow blocked', decision.reason, {
        sessionId,
      });
    } finally {
      orchestrationInFlight.delete(workflowRunId);
    }
  };
};
