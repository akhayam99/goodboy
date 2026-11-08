import { AUTO_RETURNS_WINDOW_MS, AUTO_TREE_LIMITS } from '@goodboy/core/auto';
import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  getAutoOutboxByJoinKey,
  getAutoTree,
  insertAutoOutboxStatement,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  listAutoOutbox,
  settleAutoDelegationStatement,
  type AutoAttempt,
  type AutoDelegation,
  type AutoOutcome,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import { brandId, type AutoBatchId, type AutoOutboxId } from '@goodboy/types';
import { attemptEnvelope } from './attemptEnvelope';
import { envelopeOf } from './landAttemptRevision';
import { isAutoReturnDecided } from '../../../features/auto/isAutoReturnDecided';
import { hasUnheardReturn } from './returns/hasUnheardReturn';
import { returnCountOf } from './returns/returnCountOf';
import { returnOfRow } from './returns/returnOfRow';
import type { AgentVerbContext } from './verbContext';

export type JoinParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

export type JoinOutcome =
  Readonly<{ kind: 'joined'; batchIds: ReadonlyArray<string> }> | Readonly<{ kind: 'idle' }>;

const ABORT_TREE = 'join_tree';
const ABORT_SETTLE = 'join_settle';
const RETURN_JOIN_PREFIX = 'return:';

type Member = Readonly<{
  delegation: AutoDelegation;
  latest: AutoAttempt | null;
}>;

type IsReadyParams = {
  readonly member: Member;
};

const isReady = ({ member }: IsReadyParams): boolean => {
  const { delegation, latest } = member;
  if (delegation.state === 'settled') {
    return true;
  }
  const isOpen =
    delegation.state === 'starting' ||
    delegation.state === 'running' ||
    delegation.state === 'paused';
  if (!isOpen) {
    return false;
  }
  return latest !== null && latest.state === 'ended' && latest.outcome !== null;
};

type EnvelopeParams = {
  readonly member: Member;
  readonly generation: number;
};

const envelopeFor = ({ member, generation }: EnvelopeParams): unknown => {
  const { delegation, latest } = member;
  if (delegation.state === 'settled' && delegation.result !== null) {
    return delegation.result;
  }
  const stored = latest === null ? null : envelopeOf({ attempt: latest });
  if (stored !== null) {
    return stored;
  }
  if (latest === null) {
    return null;
  }
  return {
    ...attemptEnvelope({
      delegation,
      attempt: latest,
      generation,
      exit: 'error',
      closing: null,
      costUsd: null,
    }),
    outcome: latest.outcome ?? 'failed',
    reason: latest.endReason ?? 'no_result',
  };
};

type BatchStatementsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly batchId: string;
  readonly members: ReadonlyArray<Member>;
};

const batchStatements = ({
  ctx,
  tree,
  batchId,
  members,
}: BatchStatementsParams): ReadonlyArray<Statement> => {
  const nowMs = ctx.now();
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_trees WHERE id = ? AND generation = ? AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [
        tree.id,
        tree.generation,
        ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs }),
      ],
      abortWhen: 'noRows',
      abortCode: ABORT_TREE,
    },
  ];
  const results: unknown[] = [];
  for (const member of members) {
    const envelope = envelopeFor({ member, generation: tree.generation });
    results.push(envelope);
    if (member.delegation.state === 'settled') {
      continue;
    }
    const latest = member.latest;
    if (latest === null || latest.outcome === null) {
      continue;
    }
    statements.push(
      settleAutoDelegationStatement({
        delegationId: member.delegation.id,
        generation: tree.generation,
        outcome: latest.outcome satisfies AutoOutcome,
        reason: latest.endReason,
        result: envelope,
        nowMs,
        abortCode: `${ABORT_SETTLE}:${member.delegation.id}`,
      }),
    );
  }
  statements.push(
    insertAutoOutboxStatement({
      outbox: {
        id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
        treeId: tree.id,
        generation: tree.generation,
        kind: 'results',
        joinKey: `join:${tree.generation}:${batchId}`,
        payload: { kind: 'results', batchId, results },
        nowMs,
      },
    }),
  );
  return statements;
};

const isReturned = ({ member }: IsReadyParams): boolean => {
  const { delegation, latest } = member;
  if (delegation.state === 'settled') {
    return delegation.outcome === 'blocked';
  }
  return isReady({ member }) && latest?.outcome === 'blocked';
};

type ReturnStatementsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly batchId: string;
  readonly member: Member;
  readonly returns: number;
  readonly isOverWindow: boolean;
};

const returnStatements = ({
  ctx,
  tree,
  batchId,
  member,
  returns,
  isOverWindow,
}: ReturnStatementsParams): ReadonlyArray<Statement> => {
  const nowMs = ctx.now();
  const { delegation, latest } = member;
  const envelope = envelopeFor({ member, generation: tree.generation });
  const settle =
    delegation.state === 'settled' || latest === null || latest.outcome === null
      ? []
      : [
          settleAutoDelegationStatement({
            delegationId: delegation.id,
            generation: tree.generation,
            outcome: latest.outcome satisfies AutoOutcome,
            reason: latest.endReason,
            result: envelope,
            nowMs,
            abortCode: `${ABORT_SETTLE}:${delegation.id}`,
          }),
        ];
  return [
    {
      sql: `SELECT 1 FROM auto_trees WHERE id = ? AND generation = ? AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [
        tree.id,
        tree.generation,
        ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs }),
      ],
      abortWhen: 'noRows',
      abortCode: ABORT_TREE,
    },
    ...settle,
    insertAutoOutboxStatement({
      outbox: {
        id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
        treeId: tree.id,
        generation: tree.generation,
        kind: 'results',
        joinKey: `${RETURN_JOIN_PREFIX}${tree.generation}:${delegation.id}`,
        payload: {
          kind: 'results',
          batchId,
          results: [envelope],
          returnOf: delegation.id,
          returns,
          ...(isOverWindow && { isOverWindow: true }),
        },
        nowMs,
      },
    }),
  ];
};

type MembersParams = {
  readonly ctx: AgentVerbContext;
  readonly batch: ReadonlyArray<AutoDelegation>;
};

const membersOf = async ({ ctx, batch }: MembersParams): Promise<ReadonlyArray<Member>> => {
  const members: Member[] = [];
  for (const delegation of batch) {
    const attempts = await listAutoAttemptsOfDelegation({
      db: ctx.db,
      delegationId: delegation.id,
    });
    members.push({ delegation, latest: attempts[attempts.length - 1] ?? null });
  }
  return members;
};

export const joinReady = async ({ ctx, treeId }: JoinParams): Promise<JoinOutcome> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  const tree = isOwner ? await getAutoTree({ db: ctx.db, treeId }) : null;
  if (tree === null || tree.stopState !== 'none') {
    return { kind: 'idle' };
  }
  const all = await listAutoDelegations({ db: ctx.db, treeId });
  const delegations = all.filter((delegation) => delegation.generation === tree.generation);
  const batches = new Map<AutoBatchId, AutoDelegation[]>();
  for (const delegation of delegations) {
    batches.set(delegation.batchId, [...(batches.get(delegation.batchId) ?? []), delegation]);
  }
  const rows = await listAutoOutbox({ db: ctx.db, treeId, kinds: ['results'] });
  const delivered = new Set(
    rows
      .filter((row) => row.generation === tree.generation)
      .flatMap((row) => {
        const returnOf = returnOfRow({ row });
        return returnOf === null ? [] : [returnOf];
      }),
  );
  const windowStart = ctx.now() - AUTO_RETURNS_WINDOW_MS;
  let recentReturns = rows.filter(
    (row) => row.createdAt >= windowStart && row.joinKey.startsWith(RETURN_JOIN_PREFIX),
  ).length;
  const joined: string[] = [];
  for (const [batchId, batch] of batches) {
    const existing = await getAutoOutboxByJoinKey({
      db: ctx.db,
      treeId,
      joinKey: `join:${tree.generation}:${batchId}`,
    });
    if (
      existing !== null &&
      !hasUnheardReturn({ joined: existing, tree, batch, delivered, delegations: all })
    ) {
      continue;
    }
    const members = await membersOf({ ctx, batch });
    let isHeld = false;
    for (const member of members) {
      if (
        delivered.has(member.delegation.id) ||
        !isReturned({ member }) ||
        isAutoReturnDecided({ delegation: member.delegation, delegations: all })
      ) {
        continue;
      }
      const outcome = await ctx.db.transaction({
        statements: returnStatements({
          ctx,
          tree,
          batchId,
          member,
          returns: returnCountOf({
            delegation: { ...member.delegation, state: 'settled', outcome: 'blocked' },
            delegations: all,
          }),
          isOverWindow: recentReturns + 1 > AUTO_TREE_LIMITS.returnsPerTreeWindow,
        }),
      });
      if (outcome.status !== 'committed') {
        isHeld = true;
        continue;
      }
      delivered.add(member.delegation.id);
      recentReturns += 1;
      joined.push(member.delegation.id);
    }
    const rest = members.filter((member) => !delivered.has(member.delegation.id));
    if (
      existing !== null ||
      isHeld ||
      rest.length === 0 ||
      !rest.every((member) => isReady({ member }))
    ) {
      continue;
    }
    const outcome = await ctx.db.transaction({
      statements: batchStatements({ ctx, tree, batchId, members: rest }),
    });
    if (outcome.status === 'committed') {
      joined.push(batchId);
    }
  }
  return joined.length === 0 ? { kind: 'idle' } : { kind: 'joined', batchIds: joined };
};
