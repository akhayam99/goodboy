import type {
  AgentEffort,
  AgentId,
  AgentRole,
  ProviderId,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowOrigin,
  WorkflowRunId,
  VerbosityLevel,
} from '@goodboy/types';
import { repointWorkflowRunTemplate, type WorkflowRunStepRepoint } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { uniqueStepName } from '../../../features/workflows/uniqueStepName';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import {
  invokeWorkflowUpsert,
  type WorkflowStepUpsertArgs,
} from '../../../features/workflows/workflows';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';
import { clearOrchestrationOutcome } from './clearOrchestrationOutcome';
import { patchWorkflowRun } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export type AddStepToWorkflowRunParams = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly name: string;
  readonly role: AgentRole;
  readonly promptPrefix?: string;
  readonly expectedOutput?: string;
  readonly providerOverride?: ProviderId;
  readonly modelOverride?: string;
  readonly effort?: AgentEffort;
  readonly verbosity?: VerbosityLevel;
};

export type AddStepToWorkflowRunResult =
  | { readonly kind: 'added'; readonly agentId: AgentId; readonly stepId: StepId }
  | { readonly kind: 'refused'; readonly reason: string };

const upsertArgsFromStep = (step: Step): WorkflowStepUpsertArgs => ({
  id: step.id,
  ...(step.libraryStepId != null && { libraryStepId: step.libraryStepId }),
  ...(step.role != null && { role: step.role }),
  ordinal: step.ordinal,
  name: step.name,
  promptPrefix: step.promptPrefix,
  ...(step.expectedOutput != null && { expectedOutput: step.expectedOutput }),
  ...(step.providerOverride != null && { providerOverride: step.providerOverride }),
  ...(step.modelOverride != null && { modelOverride: step.modelOverride }),
  ...(step.effort != null && { effort: step.effort }),
  ...(step.verbosity != null && { verbosity: step.verbosity }),
  ...(step.orchestratorReason != null && { orchestratorReason: step.orchestratorReason }),
  routingLock: step.routingLock ?? null,
  routingDecision: step.routingDecision ?? null,
  taskProfile: step.taskProfile ?? null,
});

type CloneParams = {
  readonly workflow: Workflow;
};

type ClonePlan = {
  readonly workflowId: WorkflowId;
  readonly steps: ReadonlyArray<WorkflowStepUpsertArgs>;
  readonly repoints: ReadonlyArray<WorkflowRunStepRepoint>;
};

const clonePlanFor = ({ workflow }: CloneParams): ClonePlan => {
  const repoints: Array<WorkflowRunStepRepoint> = [];
  const steps = [...workflow.steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((step) => {
      const toStepId = crypto.randomUUID() as StepId;
      repoints.push({ fromStepId: step.id, toStepId });
      return { ...upsertArgsFromStep(step), id: toStepId };
    });
  return { workflowId: crypto.randomUUID() as WorkflowId, steps, repoints };
};

export const addStepToWorkflowRun = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    workflowRunId,
    name,
    role,
    promptPrefix,
    expectedOutput,
    providerOverride,
    modelOverride,
    effort,
    verbosity,
  }: AddStepToWorkflowRunParams): Promise<AddStepToWorkflowRunResult> => {
    const trimmedName = name.trim();
    if (trimmedName === '') {
      return { kind: 'refused', reason: 'the step needs a name' };
    }
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (session == null || run == null) {
      return { kind: 'refused', reason: 'this workflow run is no longer attached' };
    }
    if (run.discardedAt != null) {
      return { kind: 'refused', reason: 'this run was discarded' };
    }
    const workflow =
      (get().phaseTemplates[session.workspaceId] ?? []).find(
        (candidate) => candidate.id === run.workflowId,
      ) ?? null;
    if (workflow == null) {
      return { kind: 'refused', reason: 'the workflow behind this run is missing' };
    }
    if (get().orchestratingWorkflowRuns?.[run.id] === true) {
      return { kind: 'refused', reason: 'the orchestrator is choosing the next step' };
    }

    const isClone = workflow.isPreset === true;
    const clone = isClone ? clonePlanFor({ workflow }) : null;
    const targetWorkflowId = clone?.workflowId ?? workflow.id;
    const baseSteps = clone?.steps ?? workflow.steps.map(upsertArgsFromStep);
    const ordinal = workflow.steps.reduce((max, current) => Math.max(max, current.ordinal), -1) + 1;
    const stepId = crypto.randomUUID() as StepId;
    const nextStep: WorkflowStepUpsertArgs = {
      id: stepId,
      role,
      ordinal,
      name: uniqueStepName({ requested: trimmedName, steps: workflow.steps }),
      promptPrefix: promptPrefix?.trim() ?? '',
      ...(expectedOutput != null &&
        expectedOutput.trim() !== '' && { expectedOutput: expectedOutput.trim() }),
      ...(providerOverride != null && { providerOverride }),
      ...(modelOverride != null &&
        modelOverride.trim() !== '' && {
          modelOverride: modelOverride.trim(),
        }),
      ...(effort != null && { effort }),
      ...(verbosity != null && { verbosity }),
      routingLock: null,
      routingDecision: null,
      taskProfile: null,
    };

    const origin: WorkflowOrigin = workflow.origin ?? 'custom';
    const upsertTarget = (steps: ReadonlyArray<WorkflowStepUpsertArgs>): Promise<Workflow> =>
      invokeWorkflowUpsert({
        id: targetWorkflowId,
        workspaceId: workflow.workspaceId,
        name: workflow.name,
        description: workflow.description,
        ...(workflow.goal != null && { goal: workflow.goal }),
        ...(workflow.processText != null && { processText: workflow.processText }),
        steps,
        isPreset: false,
        origin,
      });
    const saved = await upsertTarget([...baseSteps, nextStep]);

    if (clone != null) {
      await repointWorkflowRunTemplate({
        db: tauriDatabase,
        workflowRunId,
        workflowId: clone.workflowId,
        stepRepoints: clone.repoints,
      });
      const repointByFrom = new Map(
        clone.repoints.map((repoint) => [repoint.fromStepId, repoint.toStepId]),
      );
      patchWorkflowRun({
        set,
        sessionId,
        workflowRunId,
        patch: (current) => ({ ...current, workflowId: clone.workflowId }),
      });
      set((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) => {
            if (agent.workflowRunId !== workflowRunId || agent.stepId == null) {
              return agent;
            }
            const toStepId = repointByFrom.get(agent.stepId);
            return toStepId == null ? agent : { ...agent, stepId: toStepId };
          }),
        },
      }));
    }

    const patchWorkflows = (
      workflows: ReadonlyArray<Workflow>,
      next: Workflow,
      dropsSource: boolean,
    ): ReadonlyArray<Workflow> => {
      const kept = dropsSource
        ? workflows.filter((current) => current.id !== workflow.id)
        : workflows;
      const replaced = kept.map((current) => (current.id === next.id ? next : current));
      return replaced.some((current) => current.id === next.id) ? replaced : [...replaced, next];
    };

    const commitWorkflow = (next: Workflow): void => {
      const dropsSource =
        clone != null &&
        !(get().sessions.find((candidate) => candidate.id === sessionId)?.workflowRuns ?? []).some(
          (candidate) =>
            candidate.id !== workflowRunId &&
            candidate.discardedAt == null &&
            candidate.workflowId === workflow.id,
        );
      set((state) => ({
        phaseTemplates: {
          ...state.phaseTemplates,
          [workflow.workspaceId]: patchWorkflows(
            state.phaseTemplates[workflow.workspaceId] ?? [],
            next,
            false,
          ),
        },
        sessionWorkflows: {
          ...state.sessionWorkflows,
          [sessionId]: patchWorkflows(state.sessionWorkflows[sessionId] ?? [], next, dropsSource),
        },
      }));
    };

    const rollback = async (reason: string): Promise<AddStepToWorkflowRunResult> => {
      commitWorkflow(await upsertTarget(baseSteps));
      return { kind: 'refused', reason };
    };

    const existingAgents = get().sessionPhaseRuns[sessionId] ?? [];
    const baseOrdinal =
      existingAgents.reduce((max, current) => Math.max(max, current.ordinal), -1) + 1;
    const savedStep = saved.steps.find((candidate) => candidate.id === stepId);
    if (savedStep == null) {
      return rollback('the step could not be saved');
    }
    const spawned = await preSpawnWorkflowAgents({
      sessionId,
      workflowRunId,
      steps: [savedStep],
      baseOrdinal,
      defaultProvider: (session.providerOverride ??
        session.providerPreference.defaultProvider) as ProviderId,
      roleModels: roleModelsForSession({ state: get(), sessionId }),
      runRoleModels: run.roleModelOverrides ?? null,
      sessionModel: session.modelOverride ?? null,
      sessionEffort: session.effort ?? null,
      availability: workflowAvailabilitySnapshot({
        providers: get().providers ?? [],
        cooldowns: get().providerCooldowns ?? {},
        alerts: get().budgetAlerts ?? [],
        sessionId,
        isRunBudgetBlocked: false,
        nowMs: Date.now(),
      }),
    });

    const blockedStep = spawned.blocked[0];
    if (blockedStep != null) {
      return rollback(blockedStep.reason);
    }
    const agent = spawned.agents[0];
    if (agent == null) {
      return rollback('the step agent could not be created');
    }

    commitWorkflow(saved);

    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: [...(state.sessionPhaseRuns[sessionId] ?? []), agent],
      },
      transcripts: { ...state.transcripts, [agent.id]: [] },
      agentTurnState: { ...state.agentTurnState, [agent.id]: { kind: 'draft' as const } },
      agentModelOverride: { ...state.agentModelOverride, ...spawned.modelOverrides },
      agentKindOverride: { ...state.agentKindOverride, ...spawned.kindOverrides },
      agentProviderOverride: { ...state.agentProviderOverride, ...spawned.providerOverrides },
      agentEffortOverride: { ...state.agentEffortOverride, ...spawned.effortOverrides },
    }));

    if (run.executionMode === 'dynamic') {
      await clearOrchestrationOutcome({ set, sessionId, workflowRunId });
    }

    if (run.autoRun) {
      void get().maybeAutoAdvanceWorkflow(sessionId);
    }

    return { kind: 'added', agentId: agent.id, stepId: savedStep.id };
  };
};
