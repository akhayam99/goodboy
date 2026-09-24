import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateSessionWorkflowTriggerMode } from '@goodboy/db';
import { runsForWorkflowRun } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { isWorkflowRunClosedByUser } from '../../../features/workflows/isWorkflowRunClosedByUser';
import { cancelRunningSteps } from './cancelRunningSteps';
import { persistOrchestrationOutcome, persistOrchestrationStop } from './orchestrateNextStep';
import type { GetFn, SetFn } from './types';

const WORKFLOW_CLOSED_MESSAGE = 'Closed by you';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const skipPendingAgents = async ({ set, get, sessionId, workflowRunId }: Params) => {
  const pending = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId).filter(
    (agent) => agent.status === 'pending',
  );
  if (pending.length === 0) {
    return;
  }
  const completedAt = new Date().toISOString() as IsoDateTime;
  for (const agent of pending) {
    await invokeAgentUpdateStatus(agent.id, { status: 'skipped', completedAt });
  }
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
};

const holdChainedRuns = async ({ set, get, sessionId, workflowRunId }: Params) => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  const chainedIds = new Set(
    (session?.workflowRuns ?? [])
      .filter(
        (run) =>
          run.chainAfterId === workflowRunId &&
          run.triggerMode === 'after_run' &&
          run.discardedAt == null,
      )
      .map((run) => run.id),
  );
  if (chainedIds.size === 0) {
    return;
  }
  const now = new Date().toISOString() as IsoDateTime;
  for (const chainedId of chainedIds) {
    await updateSessionWorkflowTriggerMode(tauriDatabase, sessionId, chainedId, 'manual', now);
  }
  set((state) => ({
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId
        ? {
            ...candidate,
            workflowRuns: candidate.workflowRuns.map((run) =>
              chainedIds.has(run.id) ? { ...run, triggerMode: 'manual' as const } : run,
            ),
          }
        : candidate,
    ),
  }));
};

const runClose = async ({ set, get, sessionId, workflowRunId }: Params): Promise<void> => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  if (session == null || run == null || run.discardedAt != null) {
    return;
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return;
  }
  await persistOrchestrationStop({
    set,
    sessionId,
    workflowRunId,
    stop: { kind: 'closed', message: WORKFLOW_CLOSED_MESSAGE },
  });
  await cancelRunningSteps({ set, get, sessionId, workflowRunId });
  await skipPendingAgents({ set, get, sessionId, workflowRunId });
  await persistOrchestrationOutcome({ set, sessionId, workflowRunId, outcome: 'done', reason: '' });
  await holdChainedRuns({ set, get, sessionId, workflowRunId });
  void get().refreshUnreadWorkspaces();
  const workflow = (get().phaseTemplates[session.workspaceId] ?? []).find(
    (candidate) => candidate.id === run.workflowId,
  );
  const workflowName = run.title ?? workflow?.name ?? null;
  await get().recordSessionEvent({
    sessionId,
    kind: 'workflow_closed',
    payload: { runId: workflowRunId, ...(workflowName == null ? {} : { workflowName }) },
  });
};

export const closeWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    try {
      await runClose({ set, get, sessionId, workflowRunId });
    } catch (error) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't close this workflow",
        body: formatError(error),
        sessionId,
      });
    }
  };
};
