import {
  insertGoalAttachment,
  listGoalAttachmentsForRun,
  listGoalAttachmentsForSession,
} from '@goodboy/db'
import type { AttachmentInput, GoalAttachmentOwner, SessionId, WorkflowRunId } from '@goodboy/types'
import { writeAttachment } from '../../../features/chat/turn'
import { attachmentKindFor } from '../../../features/chat/attachment-kinds'
import { tauriDatabase } from '../../../shared/lib/db'
import type { GetFn, SetFn } from './types'

export const addGoalAttachments = (set: SetFn, get: GetFn) => {
  return async (
    owner: GoalAttachmentOwner,
    inputs: ReadonlyArray<AttachmentInput>,
  ): Promise<void> => {
    if (inputs.length === 0) {
      return
    }
    const sessionId = owner.type === 'session' ? (owner.id as SessionId) : get().currentSessionId
    const worktreeDir = sessionId ? (get().sessionWorktrees[sessionId] ?? [])[0] : undefined
    if (!worktreeDir) {
      throw new Error('cannot add goal attachments: session worktree not available')
    }

    for (const input of inputs) {
      const relPath = await writeAttachment({
        worktreeDir,
        attachmentId: input.id,
        fileName: input.fileName,
        dataBase64: input.dataBase64,
      })
      await insertGoalAttachment(tauriDatabase, {
        id: input.id,
        owner,
        relPath,
        kind: attachmentKindFor(input.mimeType),
        fileName: input.fileName,
        mimeType: input.mimeType,
      })
    }

    if (owner.type === 'session') {
      const sid = owner.id as SessionId
      const attachments = await listGoalAttachmentsForSession(tauriDatabase, sid)
      set((state) => ({
        sessionAttachments: { ...state.sessionAttachments, [sid]: attachments },
      }))
      return
    }
    const runId = owner.id as WorkflowRunId
    const attachments = await listGoalAttachmentsForRun(tauriDatabase, runId)
    set((state) => ({
      workflowRunAttachments: { ...state.workflowRunAttachments, [runId]: attachments },
    }))
  }
}
