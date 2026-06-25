import { deleteGoalAttachment } from '@goodboy/db'
import type { GoalAttachmentOwner, SessionId, WorkflowRunId } from '@goodboy/types'
import { deleteAttachment } from '../../../features/chat/turn'
import { tauriDatabase } from '../../../shared/lib/db'
import type { GetFn, SetFn } from './types'

export const removeGoalAttachment = (set: SetFn, get: GetFn) => {
  return async (owner: GoalAttachmentOwner, id: string): Promise<void> => {
    const state = get()
    const list =
      owner.type === 'session'
        ? state.sessionAttachments[owner.id as SessionId]
        : state.workflowRunAttachments[owner.id as WorkflowRunId]
    const target = list?.find((a) => a.id === id)

    const sessionId = owner.type === 'session' ? (owner.id as SessionId) : state.currentSessionId
    const worktreeDir = sessionId ? (state.sessionWorktrees[sessionId] ?? [])[0] : undefined
    if (target && worktreeDir) {
      await deleteAttachment(worktreeDir, target.relPath).catch(() => {})
    }
    await deleteGoalAttachment(tauriDatabase, id)

    if (owner.type === 'session') {
      const sid = owner.id as SessionId
      set((s) => ({
        sessionAttachments: {
          ...s.sessionAttachments,
          [sid]: (s.sessionAttachments[sid] ?? []).filter((a) => a.id !== id),
        },
      }))
      return
    }
    const runId = owner.id as WorkflowRunId
    set((s) => ({
      workflowRunAttachments: {
        ...s.workflowRunAttachments,
        [runId]: (s.workflowRunAttachments[runId] ?? []).filter((a) => a.id !== id),
      },
    }))
  }
}
