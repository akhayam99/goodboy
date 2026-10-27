import {
  getAutoTree,
  listAutoDelegations,
  listAutoOutbox,
  listOpenAutoDelegations,
  reconcileAutoReservationStatement,
  type AutoPhase,
} from '@goodboy/db';
import { applyAutoBlock } from './applyAutoBlock';
import { requeueStatements } from './requeueStatements';
import type { AutoTurnEnded } from './ports';
import type { AgentVerbContext } from './verbContext';

export type SettleAutoTurnParams = Readonly<{
  ctx: AgentVerbContext;
  ended: AutoTurnEnded;
}>;

export type SettleAutoTurnOutcome =
  | Readonly<{ kind: 'settled'; phase: AutoPhase }>
  | Readonly<{ kind: 'dropped'; reason: 'no_tree' | 'stale' | 'stopping' }>;

const MAX_CAS_ATTEMPTS = 3;

type ReconcileParams = {
  readonly ctx: AgentVerbContext;
  readonly ended: AutoTurnEnded;
};

const reconcileTurnCost = async ({ ctx, ended }: ReconcileParams): Promise<void> => {
  await ctx.db.transaction({
    statements: [
      reconcileAutoReservationStatement({
        treeId: ended.treeId,
        ownerKind: 'auto_turn',
        ownerId: ended.deliveryId,
        costUsd: ended.costUsd,
        nowMs: ctx.now(),
        abortCode: 'turn_reservation',
      }),
    ],
  });
};

type NextPhaseParams = {
  readonly pendingCount: number;
  readonly openCount: number;
  readonly hasDelegations: boolean;
};

const nextPhaseOf = ({ pendingCount, openCount, hasDelegations }: NextPhaseParams): AutoPhase => {
  if (pendingCount > 0) {
    return 'merging';
  }
  if (openCount > 0) {
    return 'waiting';
  }
  return hasDelegations ? 'done' : 'answering';
};

type AttemptParams = {
  readonly ctx: AgentVerbContext;
  readonly ended: AutoTurnEnded;
  readonly isRefused: boolean;
};

const settleOnce = async ({
  ctx,
  ended,
  isRefused,
}: AttemptParams): Promise<SettleAutoTurnOutcome | 'retry'> => {
  const tree = await getAutoTree({ db: ctx.db, treeId: ended.treeId });
  if (tree === null) {
    return { kind: 'dropped', reason: 'no_tree' };
  }
  const isCurrent =
    tree.generation === ended.generation &&
    tree.activeRunId === ended.runId &&
    (tree.phase === 'deciding' || tree.phase === 'delegating');
  if (!isCurrent) {
    return { kind: 'dropped', reason: 'stale' };
  }
  if (tree.stopState !== 'none') {
    return { kind: 'dropped', reason: 'stopping' };
  }
  const isYield = tree.isYieldRequested;
  const accepted = (
    await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['accepted'] })
  ).filter((row) => row.acceptedRunId === ended.runId);
  const hasFailed = ended.exit === 'error' && !isYield;
  if (hasFailed) {
    await ctx.db.transaction({ statements: requeueStatements({ ctx, tree, rows: accepted }) });
  }
  const pending = await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['pending'] });
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId: tree.id });
  const all = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  const phase = isYield
    ? ('delegating' as const)
    : nextPhaseOf({
        pendingCount: pending.length,
        openCount: open.length,
        hasDelegations: all.length > 0,
      });
  const hasProgress =
    isYield || (ended.exit === 'ok' && !isRefused && ended.assistantText.trim() !== '');
  const applied = await ctx.scheduler.transition({
    treeId: tree.id,
    expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: [tree.phase] },
    to: phase,
    patch: {
      activeRunId: null,
      activeDeliveryId: null,
      noProgressStreak: hasProgress ? 0 : tree.noProgressStreak + 1,
    },
  });
  if (applied.kind === 'applied') {
    return { kind: 'settled', phase };
  }
  return applied.reason === 'stale' ? 'retry' : { kind: 'dropped', reason: 'stale' };
};

export const settleAutoTurn = async ({
  ctx,
  ended,
}: SettleAutoTurnParams): Promise<SettleAutoTurnOutcome> => {
  await reconcileTurnCost({ ctx, ended });
  const applied = await applyAutoBlock({ ctx, ended });
  const isRefused = applied.kind === 'refused';
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const outcome = await settleOnce({ ctx, ended, isRefused });
    if (outcome !== 'retry') {
      return outcome;
    }
  }
  return { kind: 'dropped', reason: 'stale' };
};
