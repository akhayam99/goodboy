import type { SessionId } from '@goodboy/types'
import type { SetFn, WorkflowBuilderDraft } from './types'

export const setWorkflowDraft = (set: SetFn) => {
  return (sessionId: SessionId, draft: WorkflowBuilderDraft) => {
    set((s) => ({ workflowDrafts: { ...s.workflowDrafts, [sessionId]: draft } }))
  }
}
