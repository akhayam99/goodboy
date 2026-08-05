import type { SessionId } from '@goodboy/types';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { isWorkflowComplete, runsForWorkflowRun } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { workflowRunHasOpenQuestions } from '../../../features/context/openQuestionsGate';
import { BUDGET_BLOCK_MESSAGE, isBudgetBlocked } from './budgetBlock';
import { persistOrchestrationStop } from './orchestrateNextStep';
import { activateWorkflowAgentOrNotify } from './activateWorkflowAgentOrNotify';
import type { GetFn, SetFn } from './types';

const advanceInFlight = new Set<SessionId>();

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const startChainedRuns = async ({ get, sessionId }: Params): Promise<void> => {
  const state = get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (session == null) {
    return;
  }
  const templates = state.phaseTemplates[session.workspaceId] ?? [];
  const runs = state.sessionPhaseRuns[sessionId] ?? [];
  for (const candidate of session.workflowRuns) {
    if (
      candidate.discardedAt != null ||
      candidate.triggerMode !== 'after_run' ||
      candidate.chainAfterId == null
    ) {
      continue;
    }
    const predecessor = session.workflowRuns.find((r) => r.id === candidate.chainAfterId);
    if (predecessor == null || predecessor.discardedAt != null) {
      continue;
    }
    const predTemplate = templates.find((t) => t.id === predecessor.workflowId);
    if (predTemplate == null) {
      continue;
    }
    const predecessorComplete =
      predecessor.executionMode === 'dynamic'
        ? predecessor.orchestrationOutcome === 'done'
        : isWorkflowComplete(predTemplate, runsForWorkflowRun(runs, predecessor.id));
    if (predecessorComplete) {
      await get().startWorkflowRun(sessionId, candidate.id);
    }
  }
};

const runAdvance = async ({ set, get, sessionId }: Params): Promise<void> => {
  await startChainedRuns({ set, get, sessionId });

  const state = get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (session == null || session.workflowRuns.length === 0) {
    return;
  }
  const activeRuns = session.workflowRuns.filter(
    (r) => r.autoRun && r.discardedAt == null && r.triggerMode === 'immediate',
  );
  if (activeRuns.length === 0) {
    return;
  }
  if (state.summarizerStatus[sessionId]?.status === 'running') {
    return;
  }
  if (isBudgetBlocked({ alerts: state.budgetAlerts, sessionId })) {
    for (const run of activeRuns) {
      if (run.orchestrationStop?.kind === 'budget') {
        continue;
      }
      await persistOrchestrationStop({
        set,
        sessionId,
        workflowRunId: run.id,
        stop: { kind: 'budget', message: BUDGET_BLOCK_MESSAGE },
      });
    }
    return;
  }
  const templates = state.phaseTemplates[session.workspaceId] ?? [];
  const runs = state.sessionPhaseRuns[sessionId] ?? [];
  const openQuestions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
  let dynamicRunId = null as (typeof activeRuns)[number]['id'] | null;
  const nextPendingAgent = (() => {
    for (const run of activeRuns) {
      if (workflowRunHasOpenQuestions(openQuestions, run.id)) {
        continue;
      }
      const template = templates.find((t) => t.id === run.workflowId);
      if (template == null) {
        continue;
      }
      const runAgents = runsForWorkflowRun(runs, run.id);
      const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
      for (const step of sortedSteps) {
        const agent = runAgents.find((r) => r.stepId === step.id);
        if (agent == null || agent.status !== 'pending') {
          continue;
        }
        const prevSteps = sortedSteps.filter((s) => s.ordinal < step.ordinal);
        const allDone = prevSteps.every((s) =>
          runAgents.some(
            (r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped'),
          ),
        );
        if (allDone) {
          return agent;
        }
        break;
      }
      if (
        run.executionMode === 'dynamic' &&
        runAgents.every((agent) => agent.status === 'completed' || agent.status === 'skipped') &&
        run.orchestrationOutcome == null
      ) {
        dynamicRunId = run.id;
      }
    }
    return null;
  })();
  if (nextPendingAgent == null) {
    if (dynamicRunId != null) {
      await get().orchestrateNextStep(sessionId, dynamicRunId);
    }
    return;
  }
  const activated = await activateWorkflowAgentOrNotify({
    get,
    sessionId,
    agentId: nextPendingAgent.id,
    focus: 'agent',
  });
  if (activated) {
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `agent auto-spawned: ${nextPendingAgent.name}`,
      undefined,
      { sessionId },
    );
  }
};

export const maybeAutoAdvanceWorkflow = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    if (advanceInFlight.has(sessionId)) {
      return;
    }
    advanceInFlight.add(sessionId);
    try {
      await runAdvance({ set, get, sessionId });
    } finally {
      advanceInFlight.delete(sessionId);
    }
  };
};
