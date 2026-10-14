import { AUTO_TREE_LIMITS } from '@goodboy/core';
import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  casAutoDelegationStateStatement,
  endAutoAttemptStatement,
  getAutoAttempt,
  getAutoDelegation,
  getAutoTree,
  insertAutoOutboxStatement,
  pauseAutoAttemptStatement,
  reconcileAutoReservationStatement,
  releaseAutoReservationStatement,
  type AutoAttempt,
  type AutoOutcome,
  type Database,
  type NewAutoOutbox,
  type Statement,
} from '@goodboy/db';
import type { AutoAttemptId } from '@goodboy/types';

export type AttemptEnding =
  | Readonly<{
      kind: 'ended';
      outcome: AutoOutcome;
      endReason: string | null;
      costUsd: number | null;
      resultSnapshot: unknown;
    }>
  | Readonly<{
      kind: 'paused';
      questionId: string;
      costUsd: number | null;
      resultSnapshot: unknown;
    }>;

export type SettleAttemptParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  attemptId: AutoAttemptId;
  generation: number;
  ending: AttemptEnding;
  outbox?: ReadonlyArray<NewAutoOutbox>;
}>;

export type SettleDropReason = 'unknown_attempt' | 'generation' | 'attempt_state' | 'not_owner';

export type SettleAttemptOutcome =
  | Readonly<{ kind: 'settled'; attempt: AutoAttempt }>
  | Readonly<{ kind: 'dropped'; reason: SettleDropReason }>;

const ABORT_FENCE_TREE = 'fence_tree';
const ABORT_FENCE_ATTEMPT = 'fence_attempt';
const ABORT_FENCE_RESERVATION = 'fence_reservation';
const ABORT_FENCE_DELEGATION = 'fence_delegation';

type DiagnoseDropParams = {
  readonly params: SettleAttemptParams;
  readonly attempt: AutoAttempt;
};

const diagnoseDrop = async ({ params, attempt }: DiagnoseDropParams): Promise<SettleDropReason> => {
  const tree = await getAutoTree({ db: params.db, treeId: attempt.treeId });
  if (tree === null) {
    return 'unknown_attempt';
  }
  const isOwner =
    tree.schedulerOwner === params.ownerId &&
    tree.ownerLeaseExpiresAt !== null &&
    tree.ownerLeaseExpiresAt > params.nowMs;
  if (!isOwner) {
    return 'not_owner';
  }
  const current = await getAutoAttempt({ db: params.db, attemptId: params.attemptId });
  if (tree.generation !== params.generation || current?.generation !== params.generation) {
    return 'generation';
  }
  return 'attempt_state';
};

type ReleaseLateParams = {
  readonly params: SettleAttemptParams;
  readonly attempt: AutoAttempt;
};

const releaseLateReservation = async ({ params, attempt }: ReleaseLateParams): Promise<void> => {
  const release = releaseAutoReservationStatement({
    treeId: attempt.treeId,
    ownerKind: 'attempt',
    ownerId: attempt.id,
    reason: 'stale_result',
    nowMs: params.nowMs,
  });
  await params.db.execute(release.sql, release.params);
};

type EffectiveEndingParams = {
  readonly db: Database;
  readonly attempt: AutoAttempt;
  readonly ending: AttemptEnding;
};

const effectiveEnding = async ({
  db,
  attempt,
  ending,
}: EffectiveEndingParams): Promise<AttemptEnding> => {
  if (ending.kind === 'ended') {
    return ending;
  }
  const delegation = await getAutoDelegation({ db, delegationId: attempt.delegationId });
  const cycles = delegation?.questionCycles ?? 0;
  if (cycles + 1 > AUTO_TREE_LIMITS.questionCyclesPerDelegation) {
    return {
      kind: 'ended',
      outcome: 'blocked',
      endReason: 'question_limit',
      costUsd: ending.costUsd,
      resultSnapshot: ending.resultSnapshot,
    };
  }
  return ending;
};

type BuildParams = {
  readonly params: SettleAttemptParams;
  readonly attempt: AutoAttempt;
  readonly ending: AttemptEnding;
};

const endingStatements = ({ params, attempt, ending }: BuildParams): ReadonlyArray<Statement> => {
  if (ending.kind === 'ended') {
    return [
      endAutoAttemptStatement({
        attemptId: attempt.id,
        generation: params.generation,
        outcome: ending.outcome,
        endReason: ending.endReason,
        resultSnapshot: ending.resultSnapshot,
        nowMs: params.nowMs,
        abortCode: ABORT_FENCE_ATTEMPT,
      }),
    ];
  }
  return [
    pauseAutoAttemptStatement({
      attemptId: attempt.id,
      generation: params.generation,
      questionId: ending.questionId,
      resultSnapshot: ending.resultSnapshot,
      nowMs: params.nowMs,
      abortCode: ABORT_FENCE_ATTEMPT,
    }),
    casAutoDelegationStateStatement({
      delegationId: attempt.delegationId,
      generation: params.generation,
      from: ['starting', 'running'],
      to: 'paused',
      abortCode: ABORT_FENCE_DELEGATION,
    }),
    {
      sql: 'UPDATE auto_delegations SET question_cycles = question_cycles + 1 WHERE id = ?',
      params: [attempt.delegationId],
    },
    {
      sql: 'UPDATE auto_trees SET question_cycles = question_cycles + 1 WHERE id = ?',
      params: [attempt.treeId],
    },
  ];
};

const buildStatements = ({ params, attempt, ending }: BuildParams): ReadonlyArray<Statement> => {
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_trees WHERE id = ? AND generation = ? AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [
        attempt.treeId,
        params.generation,
        ...autoOwnerGuardParams({ ownerId: params.ownerId, nowMs: params.nowMs }),
      ],
      abortWhen: 'noRows',
      abortCode: ABORT_FENCE_TREE,
    },
    ...endingStatements({ params, attempt, ending }),
  ];
  statements.push(
    reconcileAutoReservationStatement({
      treeId: attempt.treeId,
      ownerKind: 'attempt',
      ownerId: attempt.id,
      costUsd: ending.costUsd,
      nowMs: params.nowMs,
      abortCode: ABORT_FENCE_RESERVATION,
    }),
    {
      sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
      params: [params.nowMs, attempt.treeId],
    },
  );
  for (const outbox of params.outbox ?? []) {
    statements.push(insertAutoOutboxStatement({ outbox }));
  }
  return statements;
};

export const settleAttempt = async (params: SettleAttemptParams): Promise<SettleAttemptOutcome> => {
  const attempt = await getAutoAttempt({ db: params.db, attemptId: params.attemptId });
  if (attempt === null) {
    return { kind: 'dropped', reason: 'unknown_attempt' };
  }
  const ending = await effectiveEnding({ db: params.db, attempt, ending: params.ending });
  const outcome = await params.db.transaction({
    statements: buildStatements({ params, attempt, ending }),
  });
  if (outcome.status === 'committed') {
    const settled = await getAutoAttempt({ db: params.db, attemptId: params.attemptId });
    return settled === null
      ? { kind: 'dropped', reason: 'unknown_attempt' }
      : { kind: 'settled', attempt: settled };
  }
  const reason = await diagnoseDrop({ params, attempt });
  if (reason !== 'not_owner' && reason !== 'unknown_attempt') {
    await releaseLateReservation({ params, attempt });
  }
  return { kind: 'dropped', reason };
};
