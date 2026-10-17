import {
  AUTO_BLOCK_TEXT,
  AUTO_MAX_GRANTS_PER_TREE,
  autoRemainingForGates,
  effectiveTreeLimits,
  turnGate,
} from '@goodboy/core';
import {
  autoTreePhaseStatement,
  getAutoTree,
  listAutoDelegations,
  listAutoOutbox,
  listOpenAutoDelegations,
  readAutoTreeSpend,
  type AutoPhase,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import type { AgentVerbContext } from './verbContext';

export type RetryBlockedTreeParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

export type RetryBlockedTreeOutcome =
  | Readonly<{ kind: 'retried'; phase: AutoPhase }>
  | Readonly<{ kind: 'refused'; message: string }>
  | Readonly<{ kind: 'idle'; reason: 'not_owner' | 'no_tree' | 'not_blocked' | 'lost_race' }>;

const NO_MORE_GRANTS =
  'Auto used every extra turn it may take in this conversation. Start a new Auto to go on.';

const ABORT_PHASE = 'retry_phase';
const ABORT_GRANT = 'retry_grant';

type PhaseParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
};

const resumePhaseOf = async ({ ctx, tree }: PhaseParams): Promise<AutoPhase> => {
  const pending = (
    await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['pending'] })
  ).filter((row) => row.generation === tree.generation);
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId: tree.id });
  if (pending.some((row) => row.kind === 'results')) {
    return 'merging';
  }
  if (open.length > 0) {
    return 'waiting';
  }
  if (pending.length > 0) {
    return 'merging';
  }
  const all = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  return all.length > 0 ? 'done' : 'answering';
};

export const retryBlockedTree = async ({
  ctx,
  treeId,
}: RetryBlockedTreeParams): Promise<RetryBlockedTreeOutcome> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  if (!isOwner) {
    return { kind: 'idle', reason: 'not_owner' };
  }
  const tree = await getAutoTree({ db: ctx.db, treeId });
  if (tree === null) {
    return { kind: 'idle', reason: 'no_tree' };
  }
  if (tree.phase !== 'blocked' || tree.stopState !== 'none') {
    return { kind: 'idle', reason: 'not_blocked' };
  }
  const isGrantNeeded = tree.turnsUsed >= effectiveTreeLimits({ grants: tree.grants }).autoTurns;
  if (isGrantNeeded && tree.grants >= AUTO_MAX_GRANTS_PER_TREE) {
    return { kind: 'refused', message: NO_MORE_GRANTS };
  }
  const nowMs = ctx.now();
  const spend = await readAutoTreeSpend({ db: ctx.db, treeId });
  const gate = turnGate({
    turnsUsed: tree.turnsUsed,
    grants: isGrantNeeded ? tree.grants + 1 : tree.grants,
    noProgressStreak: 0,
    hardDeadlineAt: tree.hardDeadlineAt,
    nowMs,
    remainingUsd: autoRemainingForGates({ spend }),
  });
  if (gate !== null) {
    return { kind: 'refused', message: AUTO_BLOCK_TEXT[gate] };
  }
  const phase = await resumePhaseOf({ ctx, tree });
  const statements: Statement[] = [
    autoTreePhaseStatement({
      treeId,
      ownerId: ctx.scheduler.ownerId,
      nowMs,
      expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: ['blocked'] },
      to: phase,
      patch: { blockedReason: null, noProgressStreak: 0 },
      abortCode: ABORT_PHASE,
    }),
  ];
  if (isGrantNeeded) {
    statements.push({
      sql: 'UPDATE auto_trees SET grants = grants + 1 WHERE id = ? AND grants = ? AND grants < ?',
      params: [treeId, tree.grants, AUTO_MAX_GRANTS_PER_TREE],
      abortWhen: 'noChanges',
      abortCode: ABORT_GRANT,
    });
  }
  const result = await ctx.db.transaction({ statements });
  if (result.status !== 'committed') {
    return { kind: 'idle', reason: 'lost_race' };
  }
  return { kind: 'retried', phase };
};
