import type { SessionId } from '@goodboy/types';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { runsForWorkflowRun } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { workflowRunHasOpenQuestions } from '../../../features/context/openQuestionsGate';
import type { GetFn, SetFn } from './types';

export function maybeAutoAdvanceWorkflow(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowRuns.length === 0) return;
    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    const activeRuns = session.workflowRuns.filter((r) => r.autoRun && !r.discardedAt);
    if (activeRuns.length === 0) return;
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    if (runs.some((r) => r.status === 'failed')) return;
    const summarizerBusy = state.summarizerStatus[sessionId]?.status === 'running';
    if (summarizerBusy) return;
    const exceeded = state.budgetAlerts.some(
      (a) =>
        a.dismissedAt === undefined &&
        ((a.kind === 'session-exceeded' && a.sessionId === sessionId) ||
          a.kind === 'provider-exceeded'),
    );
    if (exceeded) return;
    const openQuestions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
    const nextPendingAgent = (() => {
      for (const run of activeRuns) {
        if (workflowRunHasOpenQuestions(openQuestions, run.id)) continue;
        const template = templates.find((t) => t.id === run.workflowId);
        if (!template) continue;
        const runAgents = runsForWorkflowRun(runs, run.id);
        const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
        for (const step of sortedSteps) {
          const agent = runAgents.find((r) => r.stepId === step.id);
          if (!agent || agent.status !== 'pending') continue;
          const prevSteps = sortedSteps.filter((s) => s.ordinal < step.ordinal);
          const allDone = prevSteps.every((s) =>
            runAgents.some(
              (r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped'),
            ),
          );
          if (allDone) return agent;
          break;
        }
      }
      return null;
    })();
    if (!nextPendingAgent) return;
    await get().activateWorkflowAgent(sessionId, nextPendingAgent.id);
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `agent auto-spawned: ${nextPendingAgent.name}`,
      undefined,
      { sessionId },
    );
  };
}
