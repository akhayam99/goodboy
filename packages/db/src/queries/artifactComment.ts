import type {
  ArtifactComment,
  ArtifactCommentAnchor,
  ArtifactCommentStatus,
  ArtifactId,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type CommentRow = {
  readonly id: string;
  readonly session_id: string;
  readonly artifact_id: string;
  readonly revision: number;
  readonly anchor_json: string;
  readonly body: string;
  readonly status: string;
  readonly sent_turn_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
};

const COMMENT_SELECT = `SELECT id, session_id, artifact_id, revision, anchor_json, body, status,
  sent_turn_id, created_at, updated_at FROM artifact_comments`;

const STATUSES: ReadonlyArray<ArtifactCommentStatus> = ['draft', 'sent', 'addressed', 'open'];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asAnchor = ({ text }: { readonly text: string }): ArtifactCommentAnchor | null => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  if (
    value['kind'] === 'part' &&
    typeof value['index'] === 'number' &&
    typeof value['title'] === 'string'
  ) {
    return { kind: 'part', index: value['index'], title: value['title'] };
  }
  if (
    value['kind'] === 'block' &&
    typeof value['order'] === 'number' &&
    typeof value['text'] === 'string'
  ) {
    return { kind: 'block', order: value['order'], text: value['text'] };
  }
  if (
    value['kind'] === 'quote' &&
    typeof value['order'] === 'number' &&
    typeof value['text'] === 'string' &&
    typeof value['blockText'] === 'string'
  ) {
    return {
      kind: 'quote',
      order: value['order'],
      text: value['text'],
      blockText: value['blockText'],
    };
  }
  return null;
};

const toComment = ({ row }: { readonly row: CommentRow }): ArtifactComment | null => {
  const anchor = asAnchor({ text: row.anchor_json });
  if (anchor === null) {
    return null;
  }
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    artifactId: row.artifact_id as ArtifactId,
    revision: row.revision,
    anchor,
    body: row.body,
    status: STATUSES.find((status) => status === row.status) ?? 'draft',
    sentTurnId: row.sent_turn_id,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
};

export const insertArtifactComment = async ({
  db,
  id,
  sessionId,
  artifactId,
  revision,
  anchor,
  body,
  status = 'draft',
  sentTurnId = null,
  createdAt = Date.now(),
}: {
  readonly db: Database;
  readonly id: string;
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly anchor: ArtifactCommentAnchor;
  readonly body: string;
  readonly status?: ArtifactCommentStatus;
  readonly sentTurnId?: string | null;
  readonly createdAt?: number;
}): Promise<void> => {
  await db.execute(
    `INSERT INTO artifact_comments (
       id, session_id, artifact_id, revision, anchor_json, body, status, sent_turn_id,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sessionId,
      artifactId,
      revision,
      JSON.stringify(anchor),
      body,
      status,
      sentTurnId,
      createdAt,
      Date.now(),
    ],
  );
};

export const listArtifactComments = async ({
  db,
  sessionId,
}: {
  readonly db: Database;
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<ArtifactComment>> => {
  const rows = await db.select<CommentRow>(
    `${COMMENT_SELECT} WHERE session_id = ? ORDER BY created_at ASC, rowid ASC`,
    [sessionId],
  );
  return rows.flatMap((row) => {
    const comment = toComment({ row });
    return comment === null ? [] : [comment];
  });
};

export const updateArtifactCommentBody = async ({
  db,
  id,
  body,
}: {
  readonly db: Database;
  readonly id: string;
  readonly body: string;
}): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE artifact_comments SET body = ?, updated_at = ? WHERE id = ?`,
    [body, Date.now(), id],
  );
  return result.rowsAffected > 0;
};

export const setArtifactCommentsStatus = async ({
  db,
  ids,
  status,
  sentTurnId,
}: {
  readonly db: Database;
  readonly ids: ReadonlyArray<string>;
  readonly status: ArtifactCommentStatus;
  readonly sentTurnId?: string | null;
}): Promise<void> => {
  for (const id of ids) {
    await db.execute(
      sentTurnId === undefined
        ? `UPDATE artifact_comments SET status = ?, updated_at = ? WHERE id = ?`
        : `UPDATE artifact_comments SET status = ?, sent_turn_id = ?, updated_at = ? WHERE id = ?`,
      sentTurnId === undefined ? [status, Date.now(), id] : [status, sentTurnId, Date.now(), id],
    );
  }
};

export const deleteArtifactComment = async ({
  db,
  id,
}: {
  readonly db: Database;
  readonly id: string;
}): Promise<boolean> => {
  const result = await db.execute(`DELETE FROM artifact_comments WHERE id = ?`, [id]);
  return result.rowsAffected > 0;
};
