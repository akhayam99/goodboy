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
import { attachmentReadKey } from './attachmentReadKey';
import { attachmentReads } from './attachmentReads';
import { ensureScratchDir } from './ensureScratchDir';
import { SCRATCH_ATTACHMENT_PREFIX } from './scratchAttachmentPrefix';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly owner: GoalAttachmentOwner;
  readonly inputs: ReadonlyArray<AttachmentInput>;
};

export const saveGoalAttachments = async ({
  set,
  get,
  sessionId,
  owner,
  inputs,
}: Params): Promise<ReadonlyArray<string>> => {
  const worktreeDir = get().sessionWorktrees[sessionId]?.[0];
  const isScratch = worktreeDir === undefined;
  const dir = isScratch ? await ensureScratchDir({ set, get, sessionId }) : worktreeDir;
  const saved: string[] = [];
  for (const input of inputs) {
    const relPath = await writeAttachment({
      worktreeDir: dir,
      attachmentId: isScratch ? `${SCRATCH_ATTACHMENT_PREFIX}${input.id}` : input.id,
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

  const read = attachmentReads.claim({ key: attachmentReadKey({ owner }) });
  if (owner.type === 'session') {
    const sid = owner.id as SessionId;
    const attachments = await listGoalAttachmentsForSession(tauriDatabase, sid);
    if (read.isCurrent()) {
      set((state) => ({
        sessionAttachments: { ...state.sessionAttachments, [sid]: attachments },
      }));
    }
    return saved;
  }
  const runId = owner.id as WorkflowRunId;
  const attachments = await listGoalAttachmentsForRun(tauriDatabase, runId);
  if (read.isCurrent()) {
    set((state) => ({
      workflowRunAttachments: { ...state.workflowRunAttachments, [runId]: attachments },
    }));
  }
  return saved;
};
