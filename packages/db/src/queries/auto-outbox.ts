import { brandId, type AutoOutboxId, type AutoTreeId } from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement } from '../client';
import { parseAutoJson } from './auto-delegations';

export const AUTO_OUTBOX_KINDS = ['results', 'question', 'user', 'refusal'] as const;

export type AutoOutboxKind = (typeof AUTO_OUTBOX_KINDS)[number];

export const AUTO_OUTBOX_STATES = ['pending', 'claimed', 'accepted', 'dropped'] as const;

export type AutoOutboxState = (typeof AUTO_OUTBOX_STATES)[number];

export type AutoOutboxRow = Readonly<{
  id: AutoOutboxId;
  treeId: AutoTreeId;
  generation: number;
  kind: AutoOutboxKind;
  joinKey: string;
  payload: unknown;
  payloadJson: string;
  state: AutoOutboxState;
  claimedBy: string | null;
  claimExpiresAt: number | null;
  acceptedRunId: string | null;
  droppedReason: string | null;
  createdAt: number;
}>;

type OutboxDbRow = {
  readonly id: string;
  readonly tree_id: string;
  readonly generation: number;
  readonly kind: string;
  readonly join_key: string;
  readonly payload_json: string;
  readonly state: string;
  readonly claimed_by: string | null;
  readonly claim_expires_at: number | null;
  readonly accepted_run_id: string | null;
  readonly dropped_reason: string | null;
  readonly created_at: number;
};

type ValueParams = {
  readonly value: string;
};

const OUTBOX_SELECT = `SELECT id, tree_id, generation, kind, join_key, payload_json, state, claimed_by,
  claim_expires_at, accepted_run_id, dropped_reason, created_at FROM auto_outbox`;

const asKind = ({ value }: ValueParams): AutoOutboxKind =>
  AUTO_OUTBOX_KINDS.find((kind) => kind === value) ?? 'user';

const asState = ({ value }: ValueParams): AutoOutboxState =>
  AUTO_OUTBOX_STATES.find((state) => state === value) ?? 'pending';

type ToOutboxParams = {
  readonly row: OutboxDbRow;
};

const toOutbox = ({ row }: ToOutboxParams): AutoOutboxRow => ({
  id: brandId<AutoOutboxId>({ value: row.id }),
  treeId: brandId<AutoTreeId>({ value: row.tree_id }),
  generation: row.generation,
  kind: asKind({ value: row.kind }),
  joinKey: row.join_key,
  payload: parseAutoJson({ text: row.payload_json }),
  payloadJson: row.payload_json,
  state: asState({ value: row.state }),
  claimedBy: row.claimed_by,
  claimExpiresAt: row.claim_expires_at,
  acceptedRunId: row.accepted_run_id,
  droppedReason: row.dropped_reason,
  createdAt: row.created_at,
});

export type NewAutoOutbox = Readonly<{
  id: AutoOutboxId;
  treeId: AutoTreeId;
  generation: number;
  kind: AutoOutboxKind;
  joinKey: string;
  payload: unknown;
  nowMs: number;
}>;

type InsertOutboxStatementParams = {
  readonly outbox: NewAutoOutbox;
};

export const insertAutoOutboxStatement = ({
  outbox,
}: InsertOutboxStatementParams): PlainStatement => ({
  sql: `INSERT INTO auto_outbox (id, tree_id, generation, kind, join_key, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tree_id, join_key) DO NOTHING`,
  params: [
    outbox.id,
    outbox.treeId,
    outbox.generation,
    outbox.kind,
    outbox.joinKey,
    JSON.stringify(outbox.payload),
    outbox.nowMs,
  ],
});

type GetAutoOutboxParams = {
  readonly db: Database;
  readonly outboxId: AutoOutboxId;
};

export const getAutoOutbox = async ({
  db,
  outboxId,
}: GetAutoOutboxParams): Promise<AutoOutboxRow | null> => {
  const rows = await db.select<OutboxDbRow>(`${OUTBOX_SELECT} WHERE id = ?`, [outboxId]);
  const row = rows[0];
  return row === undefined ? null : toOutbox({ row });
};

type GetAutoOutboxByJoinKeyParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly joinKey: string;
};

export const getAutoOutboxByJoinKey = async ({
  db,
  treeId,
  joinKey,
}: GetAutoOutboxByJoinKeyParams): Promise<AutoOutboxRow | null> => {
  const rows = await db.select<OutboxDbRow>(`${OUTBOX_SELECT} WHERE tree_id = ? AND join_key = ?`, [
    treeId,
    joinKey,
  ]);
  const row = rows[0];
  return row === undefined ? null : toOutbox({ row });
};

type ListAutoOutboxParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly states?: ReadonlyArray<AutoOutboxState>;
};

export const listAutoOutbox = async ({
  db,
  treeId,
  states = AUTO_OUTBOX_STATES,
}: ListAutoOutboxParams): Promise<ReadonlyArray<AutoOutboxRow>> => {
  const marks = states.map(() => '?').join(', ');
  const rows = await db.select<OutboxDbRow>(
    `${OUTBOX_SELECT} WHERE tree_id = ? AND state IN (${marks}) ORDER BY created_at, rowid`,
    [treeId, ...states],
  );
  return rows.map((row) => toOutbox({ row }));
};

type InsertAutoOutboxParams = {
  readonly db: Database;
  readonly outbox: NewAutoOutbox;
};

export type InsertAutoOutboxOutcome = Readonly<{
  row: AutoOutboxRow;
  isCreated: boolean;
}>;

export const insertAutoOutbox = async ({
  db,
  outbox,
}: InsertAutoOutboxParams): Promise<InsertAutoOutboxOutcome> => {
  const statement = insertAutoOutboxStatement({ outbox });
  const result = await db.execute(statement.sql, statement.params);
  const row = await getAutoOutboxByJoinKey({
    db,
    treeId: outbox.treeId,
    joinKey: outbox.joinKey,
  });
  if (row === null) {
    throw new Error(`Auto outbox row was not stored for ${outbox.joinKey}`);
  }
  return { row, isCreated: result.rowsAffected === 1 };
};

type ClaimAutoOutboxParams = {
  readonly db: Database;
  readonly outboxId: AutoOutboxId;
  readonly generation: number;
  readonly claimedBy: string;
  readonly nowMs: number;
  readonly claimMs: number;
};

export const claimAutoOutbox = async ({
  db,
  outboxId,
  generation,
  claimedBy,
  nowMs,
  claimMs,
}: ClaimAutoOutboxParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_outbox SET state = 'claimed', claimed_by = ?, claim_expires_at = ?
     WHERE id = ? AND generation = ? AND state = 'pending'`,
    [claimedBy, nowMs + claimMs, outboxId, generation],
  );
  return result.rowsAffected === 1;
};

type ReleaseAutoOutboxClaimParams = {
  readonly db: Database;
  readonly outboxId: AutoOutboxId;
  readonly claimedBy: string;
};

export const releaseAutoOutboxClaim = async ({
  db,
  outboxId,
  claimedBy,
}: ReleaseAutoOutboxClaimParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_outbox SET state = 'pending', claimed_by = NULL, claim_expires_at = NULL
     WHERE id = ? AND state = 'claimed' AND claimed_by = ?`,
    [outboxId, claimedBy],
  );
  return result.rowsAffected === 1;
};

type AcceptOutboxStatementParams = {
  readonly outboxId: AutoOutboxId;
  readonly claimedBy: string;
  readonly runId: string;
  readonly abortCode: string;
};

export const acceptAutoOutboxStatement = ({
  outboxId,
  claimedBy,
  runId,
  abortCode,
}: AcceptOutboxStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_outbox SET state = 'accepted', accepted_run_id = ?
    WHERE id = ? AND state = 'claimed' AND claimed_by = ?`,
  params: [runId, outboxId, claimedBy],
  abortWhen: 'noChanges',
  abortCode,
});

type DropOutboxOfOldGenerationsStatementParams = {
  readonly treeId: AutoTreeId;
  readonly currentGeneration: number;
  readonly reason: string;
};

export const dropAutoOutboxOfOldGenerationsStatement = ({
  treeId,
  currentGeneration,
  reason,
}: DropOutboxOfOldGenerationsStatementParams): PlainStatement => ({
  sql: `UPDATE auto_outbox SET state = 'dropped', dropped_reason = ?
    WHERE tree_id = ? AND generation < ? AND state IN ('pending', 'claimed')`,
  params: [reason, treeId, currentGeneration],
});

type ClaimOutboxStatementParams = {
  readonly outboxId: AutoOutboxId;
  readonly generation: number;
  readonly claimedBy: string;
  readonly nowMs: number;
  readonly claimMs: number;
  readonly abortCode: string;
};

export const claimAutoOutboxStatement = ({
  outboxId,
  generation,
  claimedBy,
  nowMs,
  claimMs,
  abortCode,
}: ClaimOutboxStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_outbox SET state = 'claimed', claimed_by = ?, claim_expires_at = ?
    WHERE id = ? AND generation = ? AND state = 'pending'`,
  params: [claimedBy, nowMs + claimMs, outboxId, generation],
  abortWhen: 'noChanges',
  abortCode,
});

type StoreOutboxDeliveryStatementParams = {
  readonly outboxId: AutoOutboxId;
  readonly claimedBy: string;
  readonly delivery: Readonly<{ text: string; rowIds: ReadonlyArray<string> }>;
  readonly abortCode: string;
};

export const storeAutoOutboxDeliveryStatement = ({
  outboxId,
  claimedBy,
  delivery,
  abortCode,
}: StoreOutboxDeliveryStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_outbox SET payload_json = json_set(payload_json, '$.delivery', json(?))
    WHERE id = ? AND state = 'claimed' AND claimed_by = ?`,
  params: [JSON.stringify(delivery), outboxId, claimedBy],
  abortWhen: 'noChanges',
  abortCode,
});

type ReleaseOutboxClaimsStatementParams = {
  readonly outboxIds: ReadonlyArray<AutoOutboxId>;
  readonly claimedBy: string;
};

export const releaseAutoOutboxClaimsStatement = ({
  outboxIds,
  claimedBy,
}: ReleaseOutboxClaimsStatementParams): PlainStatement => {
  const marks = outboxIds.map(() => '?').join(', ');
  return {
    sql: `UPDATE auto_outbox SET state = 'pending', claimed_by = NULL, claim_expires_at = NULL
      WHERE id IN (${marks}) AND state = 'claimed' AND claimed_by = ?`,
    params: [...outboxIds, claimedBy],
  };
};

type DropOutboxStatementParams = {
  readonly treeId: AutoTreeId;
  readonly reason: string;
  readonly fromStates: ReadonlyArray<AutoOutboxState>;
};

export const dropAutoOutboxStatement = ({
  treeId,
  reason,
  fromStates,
}: DropOutboxStatementParams): PlainStatement => {
  const marks = fromStates.map(() => '?').join(', ');
  return {
    sql: `UPDATE auto_outbox SET state = 'dropped', dropped_reason = ?
      WHERE tree_id = ? AND state IN (${marks})`,
    params: [reason, treeId, ...fromStates],
  };
};
