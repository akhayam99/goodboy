import type {
  GoalAttachment,
  GoalAttachmentOwner,
  GoalAttachmentOwnerType,
  IsoDateTime,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

type GoalAttachmentRow = {
  id: string;
  session_id: string | null;
  workflow_run_id: string | null;
  rel_path: string;
  kind: string;
  file_name: string;
  mime_type: string;
  created_at: number;
};

function toDomain(row: GoalAttachmentRow): GoalAttachment {
  const ownerId = row.session_id ?? row.workflow_run_id;
  if (ownerId == null) {
    throw new Error(`goal attachment ${row.id} has no owner`);
  }
  const owner = {
    type: row.session_id != null ? 'session' : 'workflow_run',
    id: ownerId,
  } satisfies GoalAttachmentOwner;
  return {
    id: row.id,
    ownerType: owner.type,
    ownerId: owner.id,
    relPath: row.rel_path,
    kind: row.kind as 'image' | 'file',
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

const SELECT_COLUMNS = `id, session_id, workflow_run_id, rel_path, kind, file_name, mime_type, created_at`;

export const insertGoalAttachment = async (
  db: Database,
  attachment: {
    readonly id: string;
    readonly owner: GoalAttachmentOwner;
    readonly relPath: string;
    readonly kind: 'image' | 'file';
    readonly fileName: string;
    readonly mimeType: string;
  },
): Promise<void> => {
  await db.execute(
    `INSERT INTO goal_attachments
       (id, session_id, workflow_run_id, rel_path, kind, file_name, mime_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachment.id,
      attachment.owner.type === 'session' ? attachment.owner.id : null,
      attachment.owner.type === 'workflow_run' ? attachment.owner.id : null,
      attachment.relPath,
      attachment.kind,
      attachment.fileName,
      attachment.mimeType,
      Date.now(),
    ],
  );
};

const listForOwner = async (
  db: Database,
  ownerType: GoalAttachmentOwnerType,
  ownerId: string,
): Promise<ReadonlyArray<GoalAttachment>> => {
  const rows = await db.select<GoalAttachmentRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM goal_attachments
     WHERE ${ownerType === 'session' ? 'session_id' : 'workflow_run_id'} = ?
     ORDER BY created_at ASC`,
    [ownerId],
  );
  return rows.map(toDomain);
};

export const listGoalAttachmentsForSession = (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<GoalAttachment>> => listForOwner(db, 'session', sessionId);

export const listGoalAttachmentsForRun = (
  db: Database,
  runId: WorkflowRunId,
): Promise<ReadonlyArray<GoalAttachment>> => listForOwner(db, 'workflow_run', runId);

export const deleteGoalAttachment = async (db: Database, id: string): Promise<void> => {
  await db.execute(`DELETE FROM goal_attachments WHERE id = ?`, [id]);
};
