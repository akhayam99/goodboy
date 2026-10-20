import { substepLinkOf } from '@goodboy/core';
import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  autoTreePhaseStatement,
  dropAutoOutboxOfOldGenerationsStatement,
  getAutoTree,
  listAutoDelegations,
  listLiveAutoAttempts,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import type { CancelRunOutcome } from './ports';
import type { AgentVerbContext } from './verbContext';

export type StopTreeParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

type StuckAgent = Readonly<{
  agentId: string;
  outcome: Exclude<CancelRunOutcome['outcome'], 'exited'>;
}>;

export type StopTreeOutcome =
  | Readonly<{ kind: 'stopped' }>
  | Readonly<{ kind: 'stopping'; stuck: ReadonlyArray<StuckAgent> }>
  | Readonly<{ kind: 'idle'; reason: 'not_owner' | 'no_tree' | 'already_stopped' }>;

const MAX_REQUEST_ATTEMPTS = 3;
const ABORT_REQUEST = 'stop_request';
const ABORT_CONFIRM = 'stop_confirm';

type RequestParams = StopTreeParams & {
  readonly tree: AutoTree;
};

const requestStop = async ({ ctx, treeId, tree }: RequestParams): Promise<boolean> => {
  const nowMs = ctx.now();
  const outcome = await ctx.db.transaction({
    statements: [
      autoTreePhaseStatement({
        treeId,
        ownerId: ctx.scheduler.ownerId,
        nowMs,
        expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: [tree.phase] },
        to: 'stopping',
        patch: { stopState: 'requested', isNewGeneration: true, isYieldRequested: false },
        abortCode: ABORT_REQUEST,
      }),
      dropAutoOutboxOfOldGenerationsStatement({
        treeId,
        currentGeneration: tree.generation + 1,
        reason: 'stopped',
      }),
    ],
  });
  return outcome.status === 'committed';
};

type CancelEntry = Readonly<{
  agentId: AutoTree['rootAgentId'];
  sessionId: AutoTree['sessionId'];
}>;

type CancelAllParams = {
  readonly ctx: AgentVerbContext;
  readonly entries: ReadonlyArray<CancelEntry>;
};

const cancelAll = async ({ ctx, entries }: CancelAllParams): Promise<ReadonlyArray<StuckAgent>> => {
  const results = await Promise.all(
    entries.map(async (entry) => {
      const outcome = await ctx.ports.cancelRun({
        sessionId: entry.sessionId,
        agentId: entry.agentId,
      });
      return { agentId: String(entry.agentId), outcome: outcome.outcome };
    }),
  );
  return results.flatMap((result) =>
    result.outcome === 'exited' ? [] : [{ agentId: result.agentId, outcome: result.outcome }],
  );
};

type CloseStatementsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
};

const closeStatements = ({ ctx, tree }: CloseStatementsParams): ReadonlyArray<Statement> => {
  const nowMs = ctx.now();
  return [
    {
      sql: `SELECT 1 FROM auto_trees
        WHERE id = ? AND stop_state = 'confirming' AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [tree.id, ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs })],
      abortWhen: 'noRows',
      abortCode: ABORT_CONFIRM,
    },
    {
      sql: `UPDATE auto_reservations
        SET state = 'reconciled', actual_usd = reserved_usd, cost_known = 0, updated_at = ?
        WHERE tree_id = ? AND state = 'reserved'
          AND (owner_kind = 'auto_turn'
            OR owner_id IN (SELECT id FROM auto_attempts WHERE tree_id = ? AND run_id IS NOT NULL))`,
      params: [nowMs, tree.id, tree.id],
    },
    {
      sql: `UPDATE auto_reservations
        SET state = 'released', released_reason = 'stopped', updated_at = ?
        WHERE tree_id = ? AND state = 'reserved'`,
      params: [nowMs, tree.id],
    },
    {
      sql: `UPDATE auto_attempts
        SET state = 'ended', outcome = 'stopped', end_reason = 'stopped', ended_at = ?
        WHERE tree_id = ? AND state IN ('starting', 'running', 'paused')`,
      params: [nowMs, tree.id],
    },
    {
      sql: `UPDATE auto_artifacts
        SET approval_state = 'needs_approval', open_revise_delegation_id = NULL, rev = rev + 1
        WHERE tree_id = ? AND open_revise_delegation_id IS NOT NULL`,
      params: [tree.id],
    },
    {
      sql: `UPDATE auto_delegations
        SET state = 'settled', outcome = 'stopped', reason = 'stopped', is_stopping = 0,
            settled_at = ?,
            result_json = json_object('schemaVersion', 1, 'delegationId', id,
              'outcome', 'stopped', 'reason', 'stopped')
        WHERE tree_id = ? AND state <> 'settled'`,
      params: [nowMs, tree.id],
    },
    {
      sql: `UPDATE auto_trees
        SET phase = 'stopped', stop_state = 'confirmed', active_run_id = NULL,
            active_delivery_id = NULL, is_yield_requested = 0, phase_rev = phase_rev + 1,
            updated_at = ?
        WHERE id = ?`,
      params: [nowMs, tree.id],
    },
  ];
};

const markStuck = async ({
  ctx,
  stuck,
  treeId,
}: {
  readonly ctx: AgentVerbContext;
  readonly stuck: ReadonlyArray<StuckAgent>;
  readonly treeId: AutoTree['id'];
}): Promise<void> => {
  if (stuck.length === 0) {
    return;
  }
  const marks = stuck.map(() => '?').join(', ');
  await ctx.db.execute(
    `UPDATE auto_delegations SET is_stopping = 1
     WHERE tree_id = ? AND state <> 'settled' AND child_agent_id IN (${marks})`,
    [treeId, ...stuck.map((entry) => entry.agentId)],
  );
};

export const stopTree = async ({ ctx, treeId }: StopTreeParams): Promise<StopTreeOutcome> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  if (!isOwner) {
    return { kind: 'idle', reason: 'not_owner' };
  }
  let tree = await getAutoTree({ db: ctx.db, treeId });
  if (tree === null) {
    return { kind: 'idle', reason: 'no_tree' };
  }
  if (tree.phase === 'stopped' && tree.stopState === 'confirmed') {
    return { kind: 'idle', reason: 'already_stopped' };
  }
  if (tree.stopState === 'none') {
    let isRequested = false;
    for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS && !isRequested; attempt += 1) {
      const fresh = await getAutoTree({ db: ctx.db, treeId });
      if (fresh === null) {
        return { kind: 'idle', reason: 'no_tree' };
      }
      isRequested = await requestStop({ ctx, treeId, tree: fresh });
    }
    if (!isRequested) {
      return { kind: 'idle', reason: 'not_owner' };
    }
    tree = await getAutoTree({ db: ctx.db, treeId });
    if (tree === null) {
      return { kind: 'idle', reason: 'no_tree' };
    }
  }
  await ctx.db.execute(
    `UPDATE auto_trees SET stop_state = 'confirming', phase_rev = phase_rev + 1
     WHERE id = ? AND stop_state = 'requested'`,
    [treeId],
  );
  const attempts = await listLiveAutoAttempts({ db: ctx.db, treeId });
  const delegations = await listAutoDelegations({ db: ctx.db, treeId });
  const childOf = new Map(delegations.map((delegation) => [delegation.id, delegation]));
  const live = attempts.flatMap((attempt) => {
    const delegation = childOf.get(attempt.delegationId);
    return delegation === undefined
      ? []
      : [
          {
            entry: { agentId: delegation.childAgentId, sessionId: tree.sessionId },
            isSubstep: substepLinkOf({ request: delegation.request }) !== null,
          },
        ];
  });
  const rest: CancelEntry[] = live.filter((item) => !item.isSubstep).map((item) => item.entry);
  if (tree.activeRunId !== null) {
    rest.push({ agentId: tree.rootAgentId, sessionId: tree.sessionId });
  }
  const substepStuck = await cancelAll({
    ctx,
    entries: live.filter((item) => item.isSubstep).map((item) => item.entry),
  });
  const restStuck = await cancelAll({ ctx, entries: rest });
  const stuck = [...substepStuck, ...restStuck];
  if (stuck.length > 0) {
    await markStuck({ ctx, stuck, treeId });
    return { kind: 'stopping', stuck };
  }
  const closing = await getAutoTree({ db: ctx.db, treeId });
  if (closing === null) {
    return { kind: 'idle', reason: 'no_tree' };
  }
  const outcome = await ctx.db.transaction({ statements: closeStatements({ ctx, tree: closing }) });
  return outcome.status === 'committed' ? { kind: 'stopped' } : { kind: 'stopping', stuck: [] };
};
