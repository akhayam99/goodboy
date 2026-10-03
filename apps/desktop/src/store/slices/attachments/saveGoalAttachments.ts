import {
  insertGoalAttachment,
  listGoalAttachmentsForRun,
  listGoalAttachmentsForSession,
} from '@goodboy/db';
import type {
  AttachmentInput,
  GoalAttachmentOwner,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { writeAttachment } from '../../../features/chat/turn';
import { attachmentKindFor } from '../../../features/chat/attachment-kinds';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly worktreeDir: string;
  readonly owner: GoalAttachmentOwner;
  readonly inputs: ReadonlyArray<AttachmentInput>;
};

export const saveGoalAttachments = async ({
  set,
  worktreeDir,
  owner,
  inputs,
}: Params): Promise<ReadonlyArray<string>> => {
  const saved: string[] = [];
  for (const input of inputs) {
    const relPath = await writeAttachment({
      worktreeDir,
      attachmentId: input.id,
      fileName: input.fileName,
      dataBase64: input.dataBase64,
    });
    await insertGoalAttachment(tauriDatabase, {
      id: input.id,
      owner,
      relPath,
      kind: attachmentKindFor(input.mimeType),
      fileName: input.fileName,
      mimeType: input.mimeType,
    });
    saved.push(input.id);
  }

  if (owner.type === 'session') {
    const sid = owner.id as SessionId;
    const attachments = await listGoalAttachmentsForSession(tauriDatabase, sid);
    set((state) => ({
      sessionAttachments: { ...state.sessionAttachments, [sid]: attachments },
    }));
    return saved;
  }
  const runId = owner.id as WorkflowRunId;
  const attachments = await listGoalAttachmentsForRun(tauriDatabase, runId);
  set((state) => ({
    workflowRunAttachments: { ...state.workflowRunAttachments, [runId]: attachments },
  }));
  return saved;
};
