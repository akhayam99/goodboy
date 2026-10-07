import { updateWorkflowRunOrchestrationStop, updateWorkflowRunRulesSnapshot } from '@goodboy/db';
import { classifyWorkflowChain, runsForWorkflowRun } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRules, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { PLAN_REVISING_REASON, planRevisingOf } from '../../../features/plans/planRevising';
import { tauriDatabase } from '../../../shared/lib/db';
import { isReportedError } from '../notifications/reportedError';
import { sessionById } from '../sessions/sessionIndex';
import { findWorkflowRun } from './findWorkflowRun';
import { notifyWorkflowGateBlock } from './notifyWorkflowGateBlock';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { ApprovePlanResult, GetFn, SetFn } from './types';
import { WorkflowGateError } from './workflowActivationGate';
import { isRunHeldForPlan } from './workflowPlanApproval';

const approving = new Set<WorkflowRunId>();

const NOT_HELD: ApprovePlanResult = { kind: 'noop', reason: 'not-held' };

const CONTINUES: ApprovePlanResult = { kind: 'approved', next: 'continues', agentId: null };

type RunParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

const isPlannerRevising = ({ get, sessionId, run }: RunParams): boolean => {
  const state = get();
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  return (state.sessionPlans[sessionId] ?? []).some((plan) => {
    const planRunId =
      plan.workflowRunId ?? agents.find((agent) => agent.id === plan.agentId)?.workflowRunId;
    if (plan.status !== 'active' || planRunId !== run.id) {
      return false;
    }
    const stored = (state.sessionArtifacts[sessionId] ?? []).find(
      (artifact) => artifact.id === plan.id,
    );
    return (
      stored !== undefined &&
      planRevisingOf({ artifact: stored, turn: state.agentTurnState[stored.agentId] }).kind ===
        'revising'
    );
  });
};

type LiftParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly rulesSnapshot: WorkflowRules;
};

const liftHold = async ({
  set,
  sessionId,
  run,
  rulesSnapshot,
}: LiftParams): Promise<ApprovePlanResult | null> => {
  const approved: WorkflowRules = { ...rulesSnapshot, planApproved: true };
  try {
    await updateWorkflowRunRulesSnapshot({
      db: tauriDatabase,
      workflowRunId: run.id,
      rulesSnapshot: approved,
    });
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
  try {
    await updateWorkflowRunOrchestrationStop(tauriDatabase, run.id, null);
  } catch (error) {
    await updateWorkflowRunRulesSnapshot({
      db: tauriDatabase,
      workflowRunId: run.id,
      rulesSnapshot,
    }).catch(() => undefined);
    return { kind: 'failed', message: formatError(error) };
  }
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId: run.id,
    patch: (current) => ({
      ...withoutKeys(current, ['orchestrationStop']),
      rulesSnapshot: approved,
    }),
  });
  return null;
};

type FailureParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly error: unknown;
};

const reportStartFailure = ({ get, sessionId, error }: FailureParams): void => {
  if (error instanceof WorkflowGateError) {
    notifyWorkflowGateBlock({ error, sessionId, emitNotification: get().emitNotification });
    return;
  }
  if (!isReportedError(error)) {
    void get().reportError({ title: "The next step didn't start", error, sessionId });
  }
};

const nextPendingAgent = ({ get, sessionId, run }: RunParams): Agent | null => {
  const state = get();
  const session = sessionById(state.sessions, sessionId);
  if (session == null) {
    return null;
  }
  const template = (state.phaseTemplates[session.workspaceId] ?? []).find(
    (candidate) => candidate.id === run.workflowId,
  );
  if (template === undefined) {
    return null;
  }
  const stepAgents = runsForWorkflowRun(state.sessionPhaseRuns[sessionId] ?? [], run.id).filter(
    (agent) => agent.parentAgentId == null && agent.stepId != null,
  );
  const chain = classifyWorkflowChain(template, stepAgents);
  if (chain.kind !== 'step') {
    return null;
  }
  return (
    stepAgents.find((agent) => agent.stepId === chain.step.id && agent.status === 'pending') ?? null
  );
};

type StartParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

const startUntilStarted = ({ get, sessionId, agent }: StartParams): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    let isStarted = false;
    get()
      .activateWorkflowAgent({
        sessionId,
        agentId: agent.id,
        focus: 'none',
        onStarted: () => {
          isStarted = true;
          resolve(true);
        },
      })
      .then(
        () => resolve(isStarted),
        (error: unknown) => {
          reportStartFailure({ get, sessionId, error });
          resolve(isStarted);
        },
      );
  });

const moveRunOn = async ({ get, sessionId, run }: RunParams): Promise<ApprovePlanResult> => {
  if (run.autoRun) {
    void get().maybeAutoAdvanceWorkflow(sessionId);
    return CONTINUES;
  }
  if (run.executionMode === 'dynamic') {
    get()
      .orchestrateNextStep(sessionId, run.id)
      .catch((error: unknown) => reportStartFailure({ get, sessionId, error }));
    return CONTINUES;
  }
  const agent = nextPendingAgent({ get, sessionId, run });
  if (agent === null) {
    return CONTINUES;
  }
  const isStarted = await startUntilStarted({ get, sessionId, agent });
  return isStarted ? { kind: 'approved', next: 'started', agentId: agent.id } : CONTINUES;
};

export const approveWorkflowRunPlan = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<ApprovePlanResult> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run === null) {
      return { kind: 'noop', reason: 'missing-run' };
    }
    if (
      run.rulesSnapshot === undefined ||
      !isRunHeldForPlan({ run }) ||
      approving.has(workflowRunId)
    ) {
      return NOT_HELD;
    }
    if (isPlannerRevising({ get, sessionId, run })) {
      return { kind: 'failed', message: PLAN_REVISING_REASON };
    }
    approving.add(workflowRunId);
    try {
      const failed = await liftHold({ set, sessionId, run, rulesSnapshot: run.rulesSnapshot });
      if (failed !== null) {
        return failed;
      }
      return await moveRunOn({ get, sessionId, run });
    } finally {
      approving.delete(workflowRunId);
    }
  };
};
