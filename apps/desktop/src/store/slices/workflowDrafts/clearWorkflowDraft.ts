import type { SessionId } from '@goodboy/types'
import type { SetFn } from './types'

export const clearWorkflowDraft = (set: SetFn) => {
  return (sessionId: SessionId) => {
    set((s) => {
      if (!(sessionId in s.workflowDrafts)) {
        return s
      }
      const next = { ...s.workflowDrafts }
      delete next[sessionId]
      return { workflowDrafts: next }
    })
  }
}
