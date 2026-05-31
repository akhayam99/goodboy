import type { SessionId, Workflow } from '@goodboy/types';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { workflowHasOpenQuestions } from '../../../features/context/openQuestionsGate';
import type { GetFn, SetFn } from './types';

export function maybeAutoAdvanceWorkflow(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || !session.autoRun || session.workflowIds.length === 0) return;
    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    const discarded = new Set(session.discardedWorkflowIds ?? []);
    const attached = session.workflowIds
      .filter((wid) => !discarded.has(wid))
      .map((wid) => templates.find((t) => t.id === wid))
      .filter((t): t is Workflow => t !== undefined);
    if (attached.length === 0) return;
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
    // Per-workflow open-question gate: load fresh from the typed table so
    // we can distinguish "workflow A has a pending question" from
    // "workflow B has a pending question" and only block the relevant
    // workflow. Orphan questions (no workflow_id) block every workflow.
    const openQuestions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
    const nextPendingAgent = (() => {
      for (const template of attached) {
        if (workflowHasOpenQuestions(openQuestions, template.id)) continue;
        const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
        for (const step of sortedSteps) {
          const agent = runs.find((r) => r.stepId === step.id);
          if (!agent || agent.status !== 'pending') continue;
          const prevSteps = sortedSteps.filter((s) => s.ordinal < step.ordinal);
          const allDone = prevSteps.every((s) =>
            runs.some(
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
