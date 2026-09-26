import type {
  IntegrationDraft,
  IntegrationDraftId,
  IntegrationDraftStatus,
  IsoDateTime,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

type Row = {
  readonly id: string;
  readonly workspace_id: string;
  readonly session_id: string;
  readonly provider: string;
  readonly verb: string;
  readonly target_json: string;
  readonly body: string;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
  readonly decided_at: number | null;
};

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isJsonRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

const toDomain = (row: Row): IntegrationDraft => ({
  id: row.id as IntegrationDraftId,
  workspaceId: row.workspace_id as WorkspaceId,
  sessionId: row.session_id as SessionId,
  provider: 'slack',
  verb: row.verb,
  target: parseJsonColumn({ value: row.target_json, isValid: isStringRecord, fallback: {} }),
  body: row.body,
  status: row.status as IntegrationDraftStatus,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  decidedAt:
    row.decided_at === null ? null : (new Date(row.decided_at).toISOString() as IsoDateTime),
});

type ListPendingSlackDraftsParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
  readonly threadTs: string;
};

export const listPendingSlackDrafts = async ({
  db,
  workspaceId,
  channelId,
  threadTs,
}: ListPendingSlackDraftsParams): Promise<ReadonlyArray<IntegrationDraft>> => {
  const rows = await db.select<Row>(
    `SELECT * FROM integration_drafts
      WHERE workspace_id = ? AND provider = 'slack' AND status = 'pending'
        AND json_extract(target_json, '$.channelId') = ?
        AND json_extract(target_json, '$.threadTs') = ?
      ORDER BY created_at ASC`,
    [workspaceId, channelId, threadTs],
  );
  return rows.map(toDomain);
};

type ListPendingIntegrationDraftsForWorkspaceParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listPendingIntegrationDraftsForWorkspace = async ({
  db,
  workspaceId,
}: ListPendingIntegrationDraftsForWorkspaceParams): Promise<ReadonlyArray<IntegrationDraft>> => {
  const rows = await db.select<Row>(
    `SELECT * FROM integration_drafts
      WHERE workspace_id = ? AND status = 'pending'
      ORDER BY created_at ASC`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type DecideIntegrationDraftParams = {
  readonly db: Database;
  readonly id: string;
  readonly status: 'sent' | 'discarded';
  readonly body?: string;
};

export const decideIntegrationDraft = async ({
  db,
  id,
  status,
  body,
}: DecideIntegrationDraftParams): Promise<boolean> => {
  const now = Date.now();
  const result =
    body === undefined
      ? await db.execute(
          `UPDATE integration_drafts
              SET status = ?, updated_at = ?, decided_at = ?
            WHERE id = ? AND status = 'pending'`,
          [status, now, now, id],
        )
      : await db.execute(
          `UPDATE integration_drafts
              SET status = ?, body = ?, updated_at = ?, decided_at = ?
            WHERE id = ? AND status = 'pending'`,
          [status, body, now, now, id],
        );
  return result.rowsAffected > 0;
};
