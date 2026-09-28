import {
  HISTORY_PLAN_STATES,
  HISTORY_VERBS,
  type HistoryPlan,
  type HistoryPlanState,
  type HistoryStep,
  type MountId,
  type SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type HistoryPlanRow = {
  readonly id: string;
  readonly session_id: string;
  readonly mount_id: string;
  readonly branch: string;
  readonly base_sha: string;
  readonly head_sha: string;
  readonly items_json: string;
  readonly state: string;
  readonly backup_ref: string | null;
  readonly remote_sha_at_apply: string | null;
  readonly applied_at: number | null;
  readonly pushed_at: number | null;
  readonly created_at: number;
  readonly updated_at: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStep = (value: unknown): HistoryStep | null => {
  if (!isRecord(value) || typeof value.sha !== 'string') {
    return null;
  }
  const verb = HISTORY_VERBS.find((candidate) => candidate === value.verb);
  if (verb === undefined) {
    return null;
  }
  return {
    sha: value.sha,
    verb,
    ...(typeof value.message === 'string' && { message: value.message }),
    ...(typeof value.target === 'string' && { target: value.target }),
  };
};

const parseItems = ({ json }: { readonly json: string }): ReadonlyArray<HistoryStep> => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(toStep).filter((step): step is HistoryStep => step !== null);
  } catch {
    return [];
  }
};

const toState = ({ state }: { readonly state: string }): HistoryPlanState =>
  HISTORY_PLAN_STATES.find((candidate) => candidate === state) ?? 'discarded';

const toDomain = ({ row }: { readonly row: HistoryPlanRow }): HistoryPlan => ({
  id: row.id,
  sessionId: row.session_id as SessionId,
  mountId: row.mount_id as MountId,
  branch: row.branch,
  baseSha: row.base_sha,
  headSha: row.head_sha,
  items: parseItems({ json: row.items_json }),
  state: toState({ state: row.state }),
  backupRef: row.backup_ref,
  remoteShaAtApply: row.remote_sha_at_apply,
  appliedAt: row.applied_at,
  pushedAt: row.pushed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type MountParams = {
  readonly db: Database;
  readonly mountId: MountId;
};

export const getDraftHistoryPlan = async ({
  db,
  mountId,
}: MountParams): Promise<HistoryPlan | null> => {
  const rows = await db.select<HistoryPlanRow>(
    "SELECT * FROM history_plans WHERE mount_id = ? AND state = 'draft' LIMIT 1",
    [mountId],
  );
  const row = rows[0];
  return row === undefined ? null : toDomain({ row });
};

type SaveDraftParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly branch: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly at: number;
};

export const saveDraftHistoryPlan = async ({
  db,
  sessionId,
  mountId,
  branch,
  baseSha,
  headSha,
  items,
  at,
}: SaveDraftParams): Promise<HistoryPlan> => {
  const existing = await getDraftHistoryPlan({ db, mountId });
  const itemsJson = JSON.stringify(items);
  await (existing === null
    ? db.execute(
        `INSERT INTO history_plans
          (id, session_id, mount_id, branch, base_sha, head_sha, items_json, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [crypto.randomUUID(), sessionId, mountId, branch, baseSha, headSha, itemsJson, at, at],
      )
    : db.execute(
        `UPDATE history_plans
         SET branch = ?, base_sha = ?, head_sha = ?, items_json = ?, updated_at = ?
         WHERE id = ?`,
        [branch, baseSha, headSha, itemsJson, at, existing.id],
      ));
  const saved = await getDraftHistoryPlan({ db, mountId });
  if (saved === null) {
    throw new Error('The history plan draft was not saved.');
  }
  return saved;
};

type MarkParams = {
  readonly db: Database;
  readonly id: string;
  readonly state: Exclude<HistoryPlanState, 'draft'>;
  readonly at: number;
  readonly backupRef?: string | null;
  readonly remoteShaAtApply?: string | null;
};

export const markHistoryPlan = async ({
  db,
  id,
  state,
  at,
  backupRef,
  remoteShaAtApply,
}: MarkParams): Promise<void> => {
  await db.execute(
    `UPDATE history_plans
     SET state = ?,
         backup_ref = COALESCE(?, backup_ref),
         remote_sha_at_apply = COALESCE(?, remote_sha_at_apply),
         applied_at = CASE WHEN ? = 'applied' THEN ? ELSE applied_at END,
         pushed_at = CASE WHEN ? = 'pushed' THEN ? ELSE pushed_at END,
         updated_at = ?
     WHERE id = ?`,
    [state, backupRef ?? null, remoteShaAtApply ?? null, state, at, state, at, at, id],
  );
};
