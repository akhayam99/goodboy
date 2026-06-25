import type { PlanId, SessionId } from '@goodboy/types'
import type { GetFn, LensKind, SessionStudio, SetFn } from './types'
import { writePersistedLens } from './workSurfaceStorage'

export const setActiveLens = (set: SetFn) => {
  return (sessionId: SessionId, lens: LensKind | null): void => {
    writePersistedLens(sessionId, lens)
    set((s) => {
      const prev = s.lensHistory[sessionId]
      const trimmed = prev ? prev.entries.slice(0, prev.index + 1) : []
      const sameTop = trimmed.length > 0 && trimmed[trimmed.length - 1] === lens
      const entries = sameTop ? trimmed : [...trimmed, lens]
      return {
        activeLens: { ...s.activeLens, [sessionId]: lens },
        sessionStudio: { ...s.sessionStudio, [sessionId]: null },
        selectedAgentId: { ...s.selectedAgentId, [sessionId]: null },
        focusedWorkflowRunId:
          lens === 'workflows'
            ? s.focusedWorkflowRunId
            : { ...s.focusedWorkflowRunId, [sessionId]: null },
        lensHistory: {
          ...s.lensHistory,
          [sessionId]: { entries, index: entries.length - 1 },
        },
      }
    })
  }
}

export const lensGo = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, delta: number): void => {
    const hist = get().lensHistory[sessionId]
    if (!hist) return
    const nextIndex = Math.min(Math.max(hist.index + delta, 0), hist.entries.length - 1)
    if (nextIndex === hist.index) return
    const lens = hist.entries[nextIndex] ?? null
    writePersistedLens(sessionId, lens)
    get().deselectAgent(sessionId)
    set((s) => ({
      activeLens: { ...s.activeLens, [sessionId]: lens },
      sessionStudio: { ...s.sessionStudio, [sessionId]: null },
      lensHistory: {
        ...s.lensHistory,
        [sessionId]: { entries: hist.entries, index: nextIndex },
      },
    }))
  }
}

export const toggleWorkflowExpand = (set: SetFn) => {
  return (sessionId: SessionId, runId: string, defaultExpanded: boolean): void => {
    set((s) => {
      const current = s.workflowExpand[sessionId] ?? {}
      const next = !(current[runId] ?? defaultExpanded)
      return {
        workflowExpand: {
          ...s.workflowExpand,
          [sessionId]: { ...current, [runId]: next },
        },
        focusedWorkflowRunId: { ...s.focusedWorkflowRunId, [sessionId]: null },
      }
    })
  }
}

export const setFocusedWorkflowRun = (set: SetFn) => {
  return (sessionId: SessionId, runId: string | null): void => {
    set((s) => ({
      focusedWorkflowRunId: { ...s.focusedWorkflowRunId, [sessionId]: runId },
    }))
  }
}

export const setFocusedPlanId = (set: SetFn) => {
  return (sessionId: SessionId, planId: PlanId | null): void => {
    set((s) => ({ focusedPlanId: { ...s.focusedPlanId, [sessionId]: planId } }))
  }
}

export const setSessionStudio = (set: SetFn) => {
  return (sessionId: SessionId, studio: SessionStudio | null): void => {
    set((s) =>
      studio != null
        ? {
            sessionStudio: { ...s.sessionStudio, [sessionId]: studio },
            selectedAgentId: { ...s.selectedAgentId, [sessionId]: null },
          }
        : { sessionStudio: { ...s.sessionStudio, [sessionId]: studio } },
    )
  }
}
