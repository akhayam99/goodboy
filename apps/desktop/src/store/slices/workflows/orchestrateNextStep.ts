import { invoke } from '@tauri-apps/api/core';
import type {
  Agent,
  AgentId,
  AgentRole,
  IsoDateTime,
  OrchestratorRouting,
  ProviderId,
  ProviderRunId,
  RoleModelPreferences,
  SessionId,
  Step,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowOrchestrationOutcome,
  WorkflowRunId,
} from '@goodboy/types';
import {
  ORCHESTRATOR_STEP_BUDGET,
  ORCHESTRATOR_STEP_HARD_CAP,
  OrchestratorClient,
  OrchestratorProviderError,
  ROLE_DEFAULTS,
  enforceOrchestratorModelPool,
  orchestratorModelPool,
  recommendedModelForRole,
  resolveRoleRouting,
  resolveTaskModel,
  runsForWorkflowRun,
  type OrchestratorRoleDefault,
} from '@goodboy/core';
import {
  listOpenQuestionsForSession,
  updateWorkflowRunOrchestrationError,
  updateWorkflowRunOrchestrationOutcome,
} from '@goodboy/db';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { tauriDatabase } from '../../../shared/lib/db';
import { BUDGET_BLOCK_MESSAGE, isBudgetBlocked } from './budgetBlock';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import { recordOrchestratorUsage } from './recordOrchestratorUsage';
import type { GetFn, SetFn } from './types';

export type OrchestrateOptions = {
  readonly routing?: OrchestratorRouting;
  readonly extraHints?: string;
};

const orchestrationInFlight = new Set<WorkflowRunId>();

type DecidingParams = {
  readonly set: SetFn;
  readonly workflowRunId: WorkflowRunId;
  readonly isDeciding: boolean;
};

const setDeciding = ({ set, workflowRunId, isDeciding }: DecidingParams): void => {
  set((state) => ({
    orchestratingWorkflowRuns: { ...state.orchestratingWorkflowRuns, [workflowRunId]: isDeciding },
  }));
};

type RoleDefaultsParams = {
  readonly provider: ProviderId;
  readonly roleModels: RoleModelPreferences | null;
};

const roleDefaultsFor = ({
  provider,
  roleModels,
}: RoleDefaultsParams): ReadonlyArray<OrchestratorRoleDefault> =>
  (Object.keys(ROLE_DEFAULTS) as ReadonlyArray<AgentRole>).map((role) => ({
    role,
    model: recommendedModelForRole({ role, provider, prefs: roleModels }),
    effort: resolveRoleRouting({ role, prefs: roleModels }).effort,
  }));

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
}: EmitParams): AgentId | null => {
  const runAgents = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId);
  const agentId =
    preferredAgentId ??
    [...runAgents].sort((left, right) => right.ordinal - left.ordinal)[0]?.id ??
    get().selectedAgentId[sessionId];
  if (agentId == null) {
    return null;
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
  return agentId;
};

type PersistOutcomeParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly outcome: WorkflowOrchestrationOutcome;
  readonly reason: string;
};

const persistOrchestrationOutcome = async ({
  set,
  sessionId,
  workflowRunId,
  outcome,
  reason,
}: PersistOutcomeParams): Promise<void> => {
  const trimmed = reason.trim();
  await updateWorkflowRunOrchestrationOutcome(
    tauriDatabase,
    workflowRunId,
    outcome,
    trimmed === '' ? null : trimmed,
  );
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) =>
      trimmed === ''
        ? { ...withoutKeys(run, ['orchestrationReason']), orchestrationOutcome: outcome }
        : { ...run, orchestrationOutcome: outcome, orchestrationReason: trimmed },
  });
};

type PersistErrorParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly message: string | null;
};

export const persistOrchestrationError = async ({
  set,
  sessionId,
  workflowRunId,
  message,
}: PersistErrorParams): Promise<void> => {
  await updateWorkflowRunOrchestrationError(tauriDatabase, workflowRunId, message);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) =>
      message == null
        ? withoutKeys(run, ['orchestrationError'])
        : { ...run, orchestrationError: message },
  });
};

const failureLabel = (error: unknown): string => {
  if (error instanceof OrchestratorProviderError) {
    return `provider refused the request: ${error.detail}`;
  }
  if (error instanceof Error && error.message.includes('timed out')) {
    return 'the orchestrator timed out after 120s';
  }
  return error instanceof Error ? error.message : String(error);
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
    ...(step.modelOverride != null && { modelOverride: step.modelOverride }),
    ...(step.effort != null && { effort: step.effort }),
    ...(step.orchestratorReason != null && { orchestratorReason: step.orchestratorReason }),
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
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    options?: OrchestrateOptions,
  ): Promise<void> => {
    if (orchestrationInFlight.has(workflowRunId)) {
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
        run.discardedAt != null ||
        run.orchestrationOutcome != null
      ) {
        return;
      }
      const workflow = (get().phaseTemplates[session.workspaceId] ?? []).find(
        (candidate) => candidate.id === run.workflowId,
      );
      if (workflow == null) {
        return;
      }
      if (isBudgetBlocked({ alerts: get().budgetAlerts ?? [], sessionId })) {
        await persistOrchestrationError({
          set,
          sessionId,
          workflowRunId,
          message: BUDGET_BLOCK_MESSAGE,
        });
        return;
      }
      if (workflow.steps.length >= ORCHESTRATOR_STEP_HARD_CAP) {
        const reason = `the run reached the hard cap of ${ORCHESTRATOR_STEP_HARD_CAP} steps without closing. Review what the steps produced and start a new run for what is left.`;
        await persistOrchestrationOutcome({
          set,
          sessionId,
          workflowRunId,
          outcome: 'blocked',
          reason,
        });
        emitDecision({ get, sessionId, workflowRunId, action: 'blocked', reason });
        void get().emitNotification(
          'error',
          'warning',
          'dynamic workflow hit the step cap',
          reason,
          { sessionId },
        );
        return;
      }
      setDeciding({ set, workflowRunId, isDeciding: true });
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
      const defaultProvider = (session.providerOverride ??
        session.providerPreference.defaultProvider) as ProviderId;
      const roleModels = roleModelsForSession({ state: get(), sessionId });
      const taskModel = resolveTaskModel(
        'workflow_orchestrator',
        get().workspaceOverrides?.[session.workspaceId]?.taskModels,
        defaultProvider,
      );
      const routing = options?.routing ?? run.orchestratorRouting ?? taskModel;
      const hints = [run.orchestratorHints, options?.extraHints]
        .map((entry) => entry?.trim() ?? '')
        .filter((entry) => entry !== '')
        .join('\n');
      const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
      const roleDefaults = roleDefaultsFor({ provider: defaultProvider, roleModels });
      const modelMenu = orchestratorModelPool({ provider: defaultProvider, roleDefaults });
      const client = new OrchestratorClient({
        ...routing,
        invokeFn: invoke,
        ...(worktreePath != null && { workingDir: worktreePath }),
      });
      let result: Awaited<ReturnType<typeof client.decide>> | null = null;
      try {
        result = await client.decide({
          goal: run.goal ?? workflow.goal ?? session.goal,
          processText: workflow.processText ?? '',
          completedSteps,
          openQuestionCount: openQuestions.length,
          ...(hints !== '' && { operatorHints: hints }),
          providerId: defaultProvider,
          modelMenu,
          roleDefaults,
          stepsUsed: workflow.steps.length,
          stepBudget: ORCHESTRATOR_STEP_BUDGET,
        });
      } catch (error) {
        const message = `${failureLabel(error)} (${routing.providerId}/${routing.model})`;
        await persistOrchestrationError({ set, sessionId, workflowRunId, message });
        emitDecision({
          get,
          sessionId,
          workflowRunId,
          action: 'blocked',
          reason: `orchestrator failed: ${message}`,
        });
        void get().emitNotification('error', 'warning', 'orchestrator failed', message, {
          sessionId,
        });
        return;
      }
      const decision = result.decision;
      if (decision == null) {
        await persistOrchestrationError({
          set,
          sessionId,
          workflowRunId,
          message: `${routing.providerId}/${routing.model} replied with something that is not a decision`,
        });
        const unparseableAgentId = emitDecision({
          get,
          sessionId,
          workflowRunId,
          action: 'blocked',
          reason: 'the orchestrator reply could not be parsed, retry to continue',
        });
        await recordOrchestratorUsage({
          set,
          get,
          sessionId,
          agentId: unparseableAgentId,
          provider: routing.providerId,
          model: result.model,
          usage: result.usage,
        });
        void get().emitNotification(
          'error',
          'warning',
          'orchestrator reply unparseable',
          'the decision could not be parsed, use next step to retry',
          { sessionId },
        );
        return;
      }
      await persistOrchestrationError({ set, sessionId, workflowRunId, message: null });
      if (decision.action === 'next') {
        const enforced = enforceOrchestratorModelPool({
          step: decision.step,
          pool: modelMenu,
          roleDefaults,
        });
        if (enforced.rejection != null) {
          console.warn(
            `orchestrator picked ${enforced.rejection.requested} outside the routing pool, falling back to ${enforced.rejection.appliedModel}`,
          );
        }
        const reason = [decision.reason.trim(), enforced.rejection?.note ?? '']
          .filter((entry) => entry !== '')
          .join('\n\n');
        const agent = await appendStep({
          set,
          get,
          sessionId,
          workflowRunId,
          workflow,
          step: {
            name: enforced.step.name,
            role: enforced.step.role,
            promptPrefix: enforced.step.promptPrefix,
            ...(enforced.step.expectedOutput != null && {
              expectedOutput: enforced.step.expectedOutput,
            }),
            ...(enforced.step.model != null && { modelOverride: enforced.step.model }),
            ...(enforced.step.effort != null && { effort: enforced.step.effort }),
            ...(reason !== '' && { orchestratorReason: reason }),
          },
        });
        emitDecision({
          get,
          sessionId,
          workflowRunId,
          action: decision.action,
          reason,
          stepName: agent.name,
          preferredAgentId: agent.id,
        });
        await recordOrchestratorUsage({
          set,
          get,
          sessionId,
          agentId: agent.id,
          provider: routing.providerId,
          model: result.model,
          usage: result.usage,
        });
        await get().activateWorkflowAgent(sessionId, agent.id, undefined, 'agent');
        return;
      }
      await persistOrchestrationOutcome({
        set,
        sessionId,
        workflowRunId,
        outcome: decision.action,
        reason: decision.reason,
      });
      const terminalAgentId = emitDecision({
        get,
        sessionId,
        workflowRunId,
        action: decision.action,
        reason: decision.reason,
      });
      await recordOrchestratorUsage({
        set,
        get,
        sessionId,
        agentId: terminalAgentId,
        provider: routing.providerId,
        model: result.model,
        usage: result.usage,
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
      setDeciding({ set, workflowRunId, isDeciding: false });
    }
  };
};
