import type { SessionId } from '@goodboy/types'
import { listOpenQuestionsForSession } from '@goodboy/db'
import { isWorkflowComplete, runsForWorkflowRun } from '@goodboy/core'
import { tauriDatabase } from '../../../shared/lib/db'
import { workflowRunHasOpenQuestions } from '../../../features/context/openQuestionsGate'
import type { GetFn, SetFn } from './types'

export const maybeAutoAdvanceWorkflow = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const state = get()
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session || session.workflowRuns.length === 0) {
      return
    }
    const templates = state.phaseTemplates[session.workspaceId] ?? []
    const runs = state.sessionPhaseRuns[sessionId] ?? []

    let firedChain = false
    for (const candidate of session.workflowRuns) {
      if (
        candidate.discardedAt ||
        candidate.triggerMode !== 'after_run' ||
        !candidate.chainAfterId
      ) {
        continue
      }
      const predecessor = session.workflowRuns.find((r) => r.id === candidate.chainAfterId)
      if (!predecessor || predecessor.discardedAt) {
        continue
      }
      const predTemplate = templates.find((t) => t.id === predecessor.workflowId)
      if (!predTemplate) {
        continue
      }
      if (isWorkflowComplete(predTemplate, runsForWorkflowRun(runs, predecessor.id))) {
        await get().startWorkflowRun(sessionId, candidate.id)
        firedChain = true
      }
    }
    if (firedChain) {
      return
    }

    const activeRuns = session.workflowRuns.filter(
      (r) => r.autoRun && !r.discardedAt && r.triggerMode === 'immediate',
    )
    if (activeRuns.length === 0) {
      return
    }
    const summarizerBusy = state.summarizerStatus[sessionId]?.status === 'running'
    if (summarizerBusy) {
      return
    }
    const exceeded = state.budgetAlerts.some(
      (a) =>
        a.dismissedAt === undefined &&
        ((a.kind === 'session-exceeded' && a.sessionId === sessionId) ||
          a.kind === 'provider-exceeded'),
    )
    if (exceeded) {
      return
    }
    const openQuestions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open')
    const nextPendingAgent = (() => {
      for (const run of activeRuns) {
        if (workflowRunHasOpenQuestions(openQuestions, run.id)) {
          continue
        }
        const template = templates.find((t) => t.id === run.workflowId)
        if (!template) {
          continue
        }
        const runAgents = runsForWorkflowRun(runs, run.id)
        const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal)
        for (const step of sortedSteps) {
          const agent = runAgents.find((r) => r.stepId === step.id)
          if (!agent || agent.status !== 'pending') {
            continue
          }
          const prevSteps = sortedSteps.filter((s) => s.ordinal < step.ordinal)
          const allDone = prevSteps.every((s) =>
            runAgents.some(
              (r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped'),
            ),
          )
          if (allDone) {
            return agent
          }
          break
        }
      }
      return null
    })()
    if (!nextPendingAgent) {
      return
    }
    await get().activateWorkflowAgent(sessionId, nextPendingAgent.id)
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `agent auto-spawned: ${nextPendingAgent.name}`,
      undefined,
      { sessionId },
    )
  }
}
