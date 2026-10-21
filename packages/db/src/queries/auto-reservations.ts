import { brandId, type AutoReservationId, type AutoTreeId } from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement } from '../client';

export const AUTO_RESERVATION_OWNER_KINDS = ['attempt', 'auto_turn', 'aux'] as const;

export type AutoReservationOwnerKind = (typeof AUTO_RESERVATION_OWNER_KINDS)[number];

export type AutoReservationState = 'reserved' | 'reconciled' | 'released';

export const AUTO_USD_EPSILON = 1e-9;

type TreeRefParams = {
  readonly treeRef: string;
};

export const autoReservedUsdSql = ({ treeRef }: TreeRefParams): string =>
  `(SELECT COALESCE(SUM(reserved_usd), 0) FROM auto_reservations
     WHERE tree_id = ${treeRef} AND state = 'reserved' AND owner_kind <> 'attempt')`;

export const autoLiveUsdSql = ({ treeRef }: TreeRefParams): string =>
  `(SELECT COALESCE(SUM(telemetry_records.estimated_cost_usd), 0) FROM auto_reservations
     JOIN auto_attempts ON auto_attempts.id = auto_reservations.owner_id
       AND auto_attempts.tree_id = auto_reservations.tree_id
     JOIN telemetry_records ON telemetry_records.run_id = auto_attempts.run_id
     WHERE auto_reservations.tree_id = ${treeRef} AND auto_reservations.owner_kind = 'attempt'
       AND auto_reservations.state = 'reserved')`;

export const autoSettledUsdSql = ({ treeRef }: TreeRefParams): string =>
  `(SELECT COALESCE(SUM(actual_usd), 0) FROM auto_reservations
     WHERE tree_id = ${treeRef} AND state = 'reconciled')`;

export const autoUsedUsdSql = ({ treeRef }: TreeRefParams): string =>
  `(${autoSettledUsdSql({ treeRef })} + ${autoLiveUsdSql({ treeRef })} + ${autoReservedUsdSql({ treeRef })})`;

export const autoRemainingUsdSql = ({ treeRef }: TreeRefParams): string =>
  `(auto_trees.cap_usd - ${autoUsedUsdSql({ treeRef })})`;

export const autoBudgetCoversSql = ({ treeRef }: TreeRefParams): string =>
  `(auto_trees.cap_usd IS NULL OR ${autoRemainingUsdSql({ treeRef })} + ${AUTO_USD_EPSILON} >= ?)`;

export const autoBudgetLeftSql = ({ treeRef }: TreeRefParams): string =>
  `(auto_trees.cap_usd IS NULL OR ${autoRemainingUsdSql({ treeRef })} > ${AUTO_USD_EPSILON})`;

export type AutoTreeSpend = Readonly<{
  capUsd: number | null;
  settledUsd: number;
  liveUsd: number;
  reservedUsd: number;
  remainingUsd: number | null;
  estimatedUsd: number;
}>;

type SpendRow = {
  readonly cap_usd: number | null;
  readonly settled_usd: number;
  readonly live_usd: number;
  readonly reserved_usd: number;
  readonly remaining_usd: number | null;
  readonly estimated_usd: number;
};

type ReadAutoTreeSpendParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readAutoTreeSpend = async ({
  db,
  treeId,
}: ReadAutoTreeSpendParams): Promise<AutoTreeSpend | null> => {
  const rows = await db.select<SpendRow>(
    `SELECT auto_trees.cap_usd AS cap_usd,
       ${autoSettledUsdSql({ treeRef: 'auto_trees.id' })} AS settled_usd,
       ${autoLiveUsdSql({ treeRef: 'auto_trees.id' })} AS live_usd,
       ${autoReservedUsdSql({ treeRef: 'auto_trees.id' })} AS reserved_usd,
       ${autoRemainingUsdSql({ treeRef: 'auto_trees.id' })} AS remaining_usd,
       (SELECT COALESCE(SUM(actual_usd), 0) FROM auto_reservations
         WHERE tree_id = auto_trees.id AND state = 'reconciled' AND cost_known = 0) AS estimated_usd
     FROM auto_trees WHERE auto_trees.id = ?`,
    [treeId],
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    capUsd: row.cap_usd,
    settledUsd: row.settled_usd,
    liveUsd: row.live_usd,
    reservedUsd: row.reserved_usd,
    remainingUsd: row.remaining_usd,
    estimatedUsd: row.estimated_usd,
  };
};

export type AutoReservation = Readonly<{
  id: AutoReservationId;
  treeId: AutoTreeId;
  ownerKind: AutoReservationOwnerKind;
  ownerId: string;
  reservedUsd: number;
  state: AutoReservationState;
  actualUsd: number | null;
  isCostKnown: boolean | null;
  releasedReason: string | null;
  createdAt: number;
  updatedAt: number;
}>;

type ReservationRow = {
  readonly id: string;
  readonly tree_id: string;
  readonly owner_kind: string;
  readonly owner_id: string;
  readonly reserved_usd: number;
  readonly state: string;
  readonly actual_usd: number | null;
  readonly cost_known: number | null;
  readonly released_reason: string | null;
  readonly created_at: number;
  readonly updated_at: number;
};

type ValueParams = {
  readonly value: string;
};

const asOwnerKind = ({ value }: ValueParams): AutoReservationOwnerKind =>
  AUTO_RESERVATION_OWNER_KINDS.find((kind) => kind === value) ?? 'aux';

const asState = ({ value }: ValueParams): AutoReservationState =>
  value === 'reconciled' || value === 'released' ? value : 'reserved';

type ToReservationParams = {
  readonly row: ReservationRow;
};

const toReservation = ({ row }: ToReservationParams): AutoReservation => ({
  id: brandId<AutoReservationId>({ value: row.id }),
  treeId: brandId<AutoTreeId>({ value: row.tree_id }),
  ownerKind: asOwnerKind({ value: row.owner_kind }),
  ownerId: row.owner_id,
  reservedUsd: row.reserved_usd,
  state: asState({ value: row.state }),
  actualUsd: row.actual_usd,
  isCostKnown: row.cost_known === null ? null : row.cost_known === 1,
  releasedReason: row.released_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const RESERVATION_SELECT = `SELECT id, tree_id, owner_kind, owner_id, reserved_usd, state, actual_usd,
  cost_known, released_reason, created_at, updated_at FROM auto_reservations`;

type ListAutoReservationsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const listAutoReservations = async ({
  db,
  treeId,
}: ListAutoReservationsParams): Promise<ReadonlyArray<AutoReservation>> => {
  const rows = await db.select<ReservationRow>(
    `${RESERVATION_SELECT} WHERE tree_id = ? ORDER BY created_at, id`,
    [treeId],
  );
  return rows.map((row) => toReservation({ row }));
};

type GetAutoReservationParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerKind: AutoReservationOwnerKind;
  readonly ownerId: string;
};

export const getAutoReservation = async ({
  db,
  treeId,
  ownerKind,
  ownerId,
}: GetAutoReservationParams): Promise<AutoReservation | null> => {
  const rows = await db.select<ReservationRow>(
    `${RESERVATION_SELECT} WHERE tree_id = ? AND owner_kind = ? AND owner_id = ?`,
    [treeId, ownerKind, ownerId],
  );
  const row = rows[0];
  return row === undefined ? null : toReservation({ row });
};

type InsertReservationStatementParams = {
  readonly id: AutoReservationId;
  readonly treeId: AutoTreeId;
  readonly ownerKind: AutoReservationOwnerKind;
  readonly ownerId: string;
  readonly reservedUsd: number;
  readonly nowMs: number;
};

export const insertAutoReservationStatement = ({
  id,
  treeId,
  ownerKind,
  ownerId,
  reservedUsd,
  nowMs,
}: InsertReservationStatementParams): PlainStatement => ({
  sql: `INSERT INTO auto_reservations (
      id, tree_id, owner_kind, owner_id, reserved_usd, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  params: [id, treeId, ownerKind, ownerId, reservedUsd, nowMs, nowMs],
});

type ReserveReservationStatementParams = InsertReservationStatementParams & {
  readonly abortCode: string;
};

export const reserveAutoReservationStatement = ({
  id,
  treeId,
  ownerKind,
  ownerId,
  reservedUsd,
  nowMs,
  abortCode,
}: ReserveReservationStatementParams): GuardedStatement => ({
  sql: `INSERT INTO auto_reservations (
      id, tree_id, owner_kind, owner_id, reserved_usd, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tree_id, owner_kind, owner_id) DO UPDATE SET
      state = 'reserved', reserved_usd = excluded.reserved_usd, actual_usd = NULL,
      cost_known = NULL, released_reason = NULL, updated_at = excluded.updated_at
    WHERE auto_reservations.state = 'released'`,
  params: [id, treeId, ownerKind, ownerId, reservedUsd, nowMs, nowMs],
  abortWhen: 'noChanges',
  abortCode,
});

type ReconcileReservationStatementParams = {
  readonly treeId: AutoTreeId;
  readonly ownerKind: AutoReservationOwnerKind;
  readonly ownerId: string;
  readonly costUsd: number | null;
  readonly nowMs: number;
  readonly abortCode: string;
};

export const reconcileAutoReservationStatement = ({
  treeId,
  ownerKind,
  ownerId,
  costUsd,
  nowMs,
  abortCode,
}: ReconcileReservationStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_reservations
    SET state = 'reconciled',
        actual_usd = CASE WHEN ? IS NOT NULL THEN ?
          WHEN owner_kind = 'attempt' THEN 0 ELSE reserved_usd END,
        cost_known = CASE WHEN ? IS NULL THEN 0 ELSE 1 END,
        updated_at = ?
    WHERE tree_id = ? AND owner_kind = ? AND owner_id = ? AND state = 'reserved'`,
  params: [costUsd, costUsd, costUsd, nowMs, treeId, ownerKind, ownerId],
  abortWhen: 'noChanges',
  abortCode,
});

type ReleaseReservationStatementParams = {
  readonly treeId: AutoTreeId;
  readonly ownerKind: AutoReservationOwnerKind;
  readonly ownerId: string;
  readonly reason: string;
  readonly nowMs: number;
};

export const releaseAutoReservationStatement = ({
  treeId,
  ownerKind,
  ownerId,
  reason,
  nowMs,
}: ReleaseReservationStatementParams): PlainStatement => ({
  sql: `UPDATE auto_reservations
    SET state = 'released', released_reason = ?, updated_at = ?
    WHERE tree_id = ? AND owner_kind = ? AND owner_id = ? AND state = 'reserved'`,
  params: [reason, nowMs, treeId, ownerKind, ownerId],
});
