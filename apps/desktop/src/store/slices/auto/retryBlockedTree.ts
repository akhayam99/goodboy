import { AUTO_BLOCK_TEXT, autoRemainingForGates, turnGate } from '@goodboy/core';
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
import { pausedDeadlineStatement } from './pausedDeadlineStatement';
import type { AgentVerbContext } from './verbContext';

export type RetryBlockedTreeParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

export type RetryBlockedTreeOutcome =
  | Readonly<{ kind: 'retried'; phase: AutoPhase }>
  | Readonly<{ kind: 'refused'; message: string }>
  | Readonly<{ kind: 'idle'; reason: 'not_owner' | 'no_tree' | 'not_blocked' | 'lost_race' }>;

const ABORT_PHASE = 'retry_phase';

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
  const nowMs = ctx.now();
  const spend = await readAutoTreeSpend({ db: ctx.db, treeId });
  const gate = turnGate({
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
    pausedDeadlineStatement({ treeId, nowMs }),
  ];
  const result = await ctx.db.transaction({ statements });
  if (result.status !== 'committed') {
    return { kind: 'idle', reason: 'lost_race' };
  }
  return { kind: 'retried', phase };
};
