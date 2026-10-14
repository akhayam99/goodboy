import {
  AUTO_BLOCK_TEXT,
  AUTO_OUTBOX_CLAIM_MS,
  AUTO_TURN_CEILING_USD,
  storedDeliveryOf,
  turnGate,
} from '@goodboy/core';
import {
  AUTO_USD_EPSILON,
  acceptAutoOutboxStatement,
  autoRemainingUsdSql,
  autoTreePhaseStatement,
  claimAutoOutboxStatement,
  getAutoTree,
  reserveAutoReservationStatement,
  listAutoOutbox,
  readAutoTreeSpend,
  releaseAutoOutboxClaimsStatement,
  releaseAutoReservationStatement,
  storeAutoOutboxDeliveryStatement,
  type AutoOutboxRow,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import { brandId, type AutoReservationId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { buildDeliveryMessage } from './buildDeliveryMessage';
import { chooseDeliveryRows } from './deliveryRows';
import type { AutoTurnEnded, TurnStartOutcome } from './ports';
import type { AgentVerbContext } from './verbContext';

export type DeliverParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
  onEnded: (ended: AutoTurnEnded) => void;
}>;

export type DeliverOutcome =
  | Readonly<{ kind: 'delivered'; deliveryId: string; runId: string }>
  | Readonly<{ kind: 'accept_pending'; deliveryId: string; runId: string }>
  | Readonly<{
      kind: 'idle';
      reason: 'not_owner' | 'no_tree' | 'stopped' | 'no_rows' | 'lost_race';
    }>
  | Readonly<{ kind: 'blocked'; reason: string }>;

const ABORT_PHASE = 'deliver_phase';
const ABORT_BUDGET = 'deliver_budget';
const ABORT_ROW = 'deliver_row';
const ABORT_STORE = 'deliver_store';
const ABORT_ACCEPT = 'deliver_accept';
const ABORT_RESERVE = 'deliver_reserve';

type BlockParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly reason: string;
};

const blockTree = async ({ ctx, tree, reason }: BlockParams): Promise<DeliverOutcome> => {
  await ctx.scheduler.transition({
    treeId: tree.id,
    expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: [tree.phase] },
    to: 'blocked',
    patch: { blockedReason: reason },
  });
  return { kind: 'blocked', reason };
};

type ClaimStatementsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly rows: ReadonlyArray<AutoOutboxRow>;
  readonly runId: string;
  readonly text: string;
};

const claimStatements = ({
  ctx,
  tree,
  rows,
  runId,
  text,
}: ClaimStatementsParams): ReadonlyArray<Statement> => {
  const primary = rows[0];
  const nowMs = ctx.now();
  const ownerId = ctx.scheduler.ownerId;
  if (primary === undefined) {
    return [];
  }
  return [
    autoTreePhaseStatement({
      treeId: tree.id,
      ownerId,
      nowMs,
      expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: [tree.phase] },
      to: 'deciding',
      patch: {
        activeRunId: runId,
        activeDeliveryId: primary.id,
        isNewTurn: true,
        isYieldRequested: false,
        blockedReason: null,
      },
      abortCode: ABORT_PHASE,
    }),
    ...rows.map((row) =>
      claimAutoOutboxStatement({
        outboxId: row.id,
        generation: tree.generation,
        claimedBy: ownerId,
        nowMs,
        claimMs: AUTO_OUTBOX_CLAIM_MS,
        abortCode: `${ABORT_ROW}:${row.id}`,
      }),
    ),
    storeAutoOutboxDeliveryStatement({
      outboxId: primary.id,
      claimedBy: ownerId,
      delivery: { text, rowIds: rows.map((row) => row.id) },
      abortCode: ABORT_STORE,
    }),
    {
      sql: `SELECT 1 FROM auto_trees
        WHERE id = ? AND ${autoRemainingUsdSql({ treeRef: 'auto_trees.id' })} + ${AUTO_USD_EPSILON} >= ?`,
      params: [tree.id, AUTO_TURN_CEILING_USD],
      abortWhen: 'noRows',
      abortCode: ABORT_BUDGET,
    },
    reserveAutoReservationStatement({
      id: brandId<AutoReservationId>({ value: `reservation-turn-${primary.id}` }),
      treeId: tree.id,
      ownerKind: 'auto_turn',
      ownerId: primary.id,
      reservedUsd: AUTO_TURN_CEILING_USD,
      nowMs,
      abortCode: ABORT_RESERVE,
    }),
  ];
};

type RollbackParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly rows: ReadonlyArray<AutoOutboxRow>;
  readonly message: string;
};

const rollbackDelivery = async ({ ctx, tree, rows, message }: RollbackParams): Promise<void> => {
  const primary = rows[0];
  if (primary === undefined) {
    return;
  }
  const nowMs = ctx.now();
  const release = releaseAutoOutboxClaimsStatement({
    outboxIds: rows.map((row) => row.id),
    claimedBy: ctx.scheduler.ownerId,
  });
  const reservation = releaseAutoReservationStatement({
    treeId: tree.id,
    ownerKind: 'auto_turn',
    ownerId: primary.id,
    reason: 'delivery_failed',
    nowMs,
  });
  await ctx.db.transaction({
    statements: [
      release,
      reservation,
      {
        sql: `UPDATE auto_trees
          SET turns_used = MAX(turns_used - 1, 0), phase = 'blocked', blocked_reason = ?,
              active_run_id = NULL, active_delivery_id = NULL, is_yield_requested = 0,
              phase_rev = phase_rev + 1, updated_at = ?
          WHERE id = ? AND active_delivery_id = ? AND phase = 'deciding'`,
        params: [message, nowMs, tree.id, primary.id],
      },
    ],
  });
};

type AcceptParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly rows: ReadonlyArray<AutoOutboxRow>;
  readonly started: Extract<TurnStartOutcome, { kind: 'started' | 'duplicate' }>;
  readonly plannedRunId: string;
};

const acceptDelivery = async ({
  ctx,
  tree,
  rows,
  started,
  plannedRunId,
}: AcceptParams): Promise<boolean> => {
  const primary = rows[0];
  if (primary === undefined) {
    return false;
  }
  const statements: Statement[] = rows.map((row) =>
    acceptAutoOutboxStatement({
      outboxId: row.id,
      claimedBy: ctx.scheduler.ownerId,
      runId: started.runId,
      abortCode: `${ABORT_ACCEPT}:${row.id}`,
    }),
  );
  if (started.runId !== plannedRunId) {
    statements.push({
      sql: `UPDATE auto_trees SET active_run_id = ?, phase_rev = phase_rev + 1
        WHERE id = ? AND active_delivery_id = ?`,
      params: [started.runId, tree.id, primary.id],
    });
  }
  const outcome = await ctx.db.transaction({ statements });
  return outcome.status === 'committed';
};

export const deliverNext = async ({
  ctx,
  treeId,
  onEnded,
}: DeliverParams): Promise<DeliverOutcome> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  if (!isOwner) {
    return { kind: 'idle', reason: 'not_owner' };
  }
  const tree = await getAutoTree({ db: ctx.db, treeId });
  if (tree === null) {
    return { kind: 'idle', reason: 'no_tree' };
  }
  if (tree.stopState !== 'none' || tree.phase === 'stopping' || tree.phase === 'stopped') {
    return { kind: 'idle', reason: 'stopped' };
  }
  const pending = await listAutoOutbox({ db: ctx.db, treeId, states: ['pending'] });
  const rows = chooseDeliveryRows({ phase: tree.phase, generation: tree.generation, pending });
  const primary = rows[0];
  if (primary === undefined) {
    return { kind: 'idle', reason: 'no_rows' };
  }
  const spend = await readAutoTreeSpend({ db: ctx.db, treeId });
  const gate = turnGate({
    turnsUsed: tree.turnsUsed,
    grants: tree.grants,
    noProgressStreak: tree.noProgressStreak,
    hardDeadlineAt: tree.hardDeadlineAt,
    nowMs: ctx.now(),
    remainingUsd: spend?.remainingUsd ?? 0,
  });
  if (gate !== null) {
    return blockTree({ ctx, tree, reason: AUTO_BLOCK_TEXT[gate] });
  }
  const stored = storedDeliveryOf({ value: primary.payload });
  const text =
    stored !== null && stored.rowIds.length === rows.length
      ? stored.text
      : await buildDeliveryMessage({ db: ctx.db, tree, rows, nowMs: ctx.now() });
  const runId = ctx.ports.newId();
  const claimed = await ctx.db.transaction({
    statements: claimStatements({ ctx, tree, rows, runId, text }),
  });
  if (claimed.status === 'aborted') {
    if (claimed.abortCode === ABORT_BUDGET) {
      return blockTree({ ctx, tree, reason: AUTO_BLOCK_TEXT.budget });
    }
    return { kind: 'idle', reason: 'lost_race' };
  }
  const outcome = await ctx.ports
    .startAutoTurn({
      treeId,
      agentId: tree.rootAgentId,
      sessionId: tree.sessionId,
      generation: tree.generation,
      runId,
      deliveryId: primary.id,
      text,
      onEnded,
    })
    .catch((error: unknown): TurnStartOutcome => ({
      kind: 'refused',
      message: formatError(error),
    }));
  if (outcome.kind === 'refused') {
    await rollbackDelivery({ ctx, tree, rows, message: outcome.message });
    return { kind: 'blocked', reason: outcome.message };
  }
  const isAccepted = await acceptDelivery({
    ctx,
    tree,
    rows,
    started: outcome,
    plannedRunId: runId,
  });
  return isAccepted
    ? { kind: 'delivered', deliveryId: primary.id, runId: outcome.runId }
    : { kind: 'accept_pending', deliveryId: primary.id, runId: outcome.runId };
};
