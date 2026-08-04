import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { classifyWorkflowChain, findReusableAgent, runsForWorkflowRun } from '@goodboy/core';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export const skipStuckStepAndAdvance = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    options?: { readonly onlyWhenBlocked?: boolean },
  ): Promise<void> => {
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
    if (options?.onlyWhenBlocked === true && chain.kind !== 'blocked') {
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
    await invokeAgentUpdateStatus(stuckAgent.id, { status: 'skipped', completedAt: nowIso() });
    const refreshed = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
    void get().refreshUnreadWorkspaces();

    const nextChain = classifyWorkflowChain(template, runsForWorkflowRun(refreshed, workflowRunId));
    if (nextChain.kind !== 'step') {
      return;
    }
    const nextAgent = runsForWorkflowRun(refreshed, workflowRunId).find(
      (r) => r.stepId === nextChain.step.id && r.status === 'pending',
    );
    if (!nextAgent) {
      return;
    }
    await get().activateWorkflowAgent(sessionId, nextAgent.id, undefined, 'agent');
  };
};
