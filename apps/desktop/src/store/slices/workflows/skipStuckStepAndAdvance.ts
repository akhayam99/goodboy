import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { classifyWorkflowChain, findReusableAgent, runsForWorkflowRun } from '@goodboy/core';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { formatError } from '../../../shared/lib/errors';
import type { GetFn, SetFn } from './types';

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

type SkipParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly onlyWhenBlocked: boolean;
};

const runSkipAndAdvance = async ({
  set,
  get,
  sessionId,
  workflowRunId,
  onlyWhenBlocked,
}: SkipParams): Promise<void> => {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return;
  }
  const run = session.workflowRuns.find((r) => r.id === workflowRunId);
  if (!run || run.discardedAt) {
    return;
  }
  const templates = get().phaseTemplates[session.workspaceId] ?? [];
  const template = templates.find((t) => t.id === run.workflowId);
  if (!template) {
    return;
  }
  const runs = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId);
  const chain = classifyWorkflowChain(template, runs);
  if (chain.kind === 'complete') {
    return;
  }
  if (onlyWhenBlocked && chain.kind !== 'blocked') {
    return;
  }
  const stuckStep = chain.kind === 'blocked' ? chain.failedStep : chain.step;
  const stuckAgent = findReusableAgent(runs, stuckStep.id);
  if (!stuckAgent || stuckAgent.status === 'pending') {
    return;
  }
  const turn = get().agentTurnState[stuckAgent.id];
  if (turn?.kind === 'running' || turn?.kind === 'starting') {
    return;
  }
  if (stuckAgent.status === 'running' && turn === undefined) {
    return;
  }
  await invokeAgentUpdateStatus(stuckAgent.id, { status: 'skipped', completedAt: nowIso() });
  const refreshed = await invokeAgentList(sessionId);
  set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  void get().refreshUnreadWorkspaces();

  const refreshedRunAgents = runsForWorkflowRun(refreshed, workflowRunId);
  const nextChain = classifyWorkflowChain(template, refreshedRunAgents);
  if (nextChain.kind === 'step') {
    const nextAgent = refreshedRunAgents.find(
      (candidate) => candidate.stepId === nextChain.step.id && candidate.status === 'pending',
    );
    if (nextAgent != null) {
      await get().activateWorkflowAgent({
        sessionId,
        agentId: nextAgent.id,
        focus: 'agent',
        bypassGate: true,
      });
      return;
    }
  }
  if (run.executionMode === 'dynamic' && run.orchestrationOutcome == null) {
    await get().orchestrateNextStep(sessionId, workflowRunId, { bypassGate: true });
  }
};

export const skipStuckStepAndAdvance = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    options?: { readonly onlyWhenBlocked?: boolean },
  ): Promise<void> => {
    try {
      await runSkipAndAdvance({
        set,
        get,
        sessionId,
        workflowRunId,
        onlyWhenBlocked: options?.onlyWhenBlocked === true,
      });
    } catch (error) {
      void get().emitNotification(
        'error',
        'warning',
        'the blocked step was not skipped',
        formatError(error),
        { sessionId },
      );
    }
  };
};
