import { storedDeliveryOf } from '@goodboy/core';
import {
  acceptAutoOutboxStatement,
  getAutoDelegation,
  getAutoTree,
  listAutoAttemptsOfDelegation,
  listAutoAttemptsOfTree,
  listAutoOutbox,
  listLiveAutoAttempts,
  listOpenAutoDelegations,
  releaseAutoOutboxClaimsStatement,
  releaseAutoReservationStatement,
  type AutoAttempt,
  type AutoOutboxRow,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import { failAttempt } from './failAttempt';
import { finishAttempt } from './finishAttempt';
import { landAttemptRevision } from './landAttemptRevision';
import type { ChildTurnEnded, RunOutcome } from './ports';
import { pushSettledPublish } from './pushSettledPublish';
import { settleAutoTurn } from './settleAutoTurn';
import type { SleepParams } from './startDeliveredTurn';
import { stopTree } from './stopTree';
import { watchRun } from './watchRun';
import type { AgentVerbContext } from './verbContext';

export type RecoverParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
  sleep: (params: SleepParams) => Promise<void>;
  maxPolls: number;
}>;

export type RecoverOutcome =
  | Readonly<{ kind: 'recovered'; watchers: ReadonlyArray<Promise<void>> }>
  | Readonly<{ kind: 'idle'; reason: 'not_owner' | 'no_tree' }>;

type Watchers = Array<Promise<void>>;

type ClaimedParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly watchers: Watchers;
  readonly sleep: RecoverParams['sleep'];
  readonly maxPolls: number;
};

const ABORT_ACCEPT = 'recover_accept';

type RowsOfParams = {
  readonly claimed: ReadonlyArray<AutoOutboxRow>;
  readonly primary: AutoOutboxRow;
};

const rowsOfDelivery = ({ claimed, primary }: RowsOfParams): ReadonlyArray<AutoOutboxRow> => {
  const stored = storedDeliveryOf({ value: primary.payload });
  const ids = new Set(stored?.rowIds ?? [String(primary.id)]);
  return claimed.filter((row) => ids.has(String(row.id)));
};

const watchAutoRun = async ({
  ctx,
  tree,
  runId,
  deliveryId,
  sleep,
  maxPolls,
}: ClaimedParams & { readonly runId: string; readonly deliveryId: string }): Promise<void> => {
  const watched = await watchRun({
    ports: ctx.ports,
    run: { runId, agentId: tree.rootAgentId, sessionId: tree.sessionId },
    sleep,
    maxPolls,
  });
  if (watched.kind === 'still_live') {
    return;
  }
  await settleAutoTurn({
    ctx,
    ended: {
      treeId: tree.id,
      generation: tree.generation,
      runId,
      deliveryId,
      agentId: tree.rootAgentId,
      assistantText: watched.outcome?.assistantText ?? '',
      exit: watched.outcome?.exit ?? 'error',
      costUsd: watched.outcome?.costUsd ?? null,
    },
  });
};

const recoverClaimedRows = async (params: ClaimedParams): Promise<void> => {
  const { ctx, tree, watchers } = params;
  const claimed = (
    await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['claimed'] })
  ).filter((row) => row.generation === tree.generation);
  const primaries = claimed.filter((row) => {
    const stored = storedDeliveryOf({ value: row.payload });
    return stored !== null && stored.rowIds[0] === String(row.id);
  });
  for (const primary of primaries) {
    const rows = rowsOfDelivery({ claimed, primary });
    const run = await ctx.ports.lookupDeliveryRun({ deliveryId: primary.id });
    if (run !== null) {
      const statements: Statement[] = rows.map((row) =>
        acceptAutoOutboxStatement({
          outboxId: row.id,
          claimedBy: row.claimedBy ?? '',
          runId: run.runId,
          abortCode: `${ABORT_ACCEPT}:${row.id}`,
        }),
      );
      statements.push({
        sql: `UPDATE auto_trees SET active_run_id = ?, phase_rev = phase_rev + 1
          WHERE id = ? AND active_delivery_id = ?`,
        params: [run.runId, tree.id, primary.id],
      });
      await ctx.db.transaction({ statements });
      if (run.isLive) {
        watchers.push(watchAutoRun({ ...params, runId: run.runId, deliveryId: primary.id }));
      }
      continue;
    }
    const statements: Statement[] = [
      ...rows.map((row) =>
        releaseAutoOutboxClaimsStatement({
          outboxIds: [row.id],
          claimedBy: row.claimedBy ?? '',
        }),
      ),
      releaseAutoReservationStatement({
        treeId: tree.id,
        ownerKind: 'auto_turn',
        ownerId: primary.id,
        reason: 'delivery_not_started',
        nowMs: ctx.now(),
      }),
      {
        sql: `UPDATE auto_trees
          SET turns_used = MAX(turns_used - 1, 0), phase = 'merging', active_run_id = NULL,
              active_delivery_id = NULL, is_yield_requested = 0, phase_rev = phase_rev + 1,
              updated_at = ?
          WHERE id = ? AND active_delivery_id = ? AND phase = 'deciding'`,
        params: [ctx.now(), tree.id, primary.id],
      },
    ];
    await ctx.db.transaction({ statements });
  }
};

const recoverAutoTurn = async (params: ClaimedParams): Promise<void> => {
  const { ctx, watchers } = params;
  const tree = await getAutoTree({ db: ctx.db, treeId: params.tree.id });
  if (
    tree === null ||
    tree.activeRunId === null ||
    (tree.phase !== 'deciding' && tree.phase !== 'delegating')
  ) {
    return;
  }
  const deliveryId = tree.activeDeliveryId ?? '';
  const runId = tree.activeRunId;
  const isLive = await ctx.ports.isRunLive({ runId });
  if (isLive) {
    watchers.push(watchAutoRun({ ...params, tree, runId, deliveryId }));
    return;
  }
  const outcome = await ctx.ports.readRunOutcome({
    runId,
    agentId: tree.rootAgentId,
    sessionId: tree.sessionId,
  });
  await settleAutoTurn({
    ctx,
    ended: {
      treeId: tree.id,
      generation: tree.generation,
      runId,
      deliveryId,
      agentId: tree.rootAgentId,
      assistantText: outcome?.assistantText ?? '',
      exit: outcome?.exit ?? 'error',
      costUsd: outcome?.costUsd ?? null,
    },
  });
};

type ChildEndParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly attempt: AutoAttempt;
  readonly outcome: RunOutcome | null;
};

const closeChild = async ({ ctx, tree, attempt, outcome }: ChildEndParams): Promise<void> => {
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId: attempt.delegationId });
  if (delegation === null) {
    return;
  }
  if (outcome === null || outcome.assistantText === '') {
    await failAttempt({
      ctx,
      delegation,
      attempt,
      generation: tree.generation,
      reason: 'interrupted',
    });
    return;
  }
  const ended: ChildTurnEnded = {
    treeId: tree.id,
    generation: tree.generation,
    delegationId: delegation.id,
    attemptId: attempt.id,
    runId: attempt.runId ?? '',
    childAgentId: delegation.childAgentId,
    sessionId: tree.sessionId,
    assistantText: outcome.assistantText,
    exit: outcome.exit,
    costUsd: outcome.costUsd,
    filesTouched: [],
    durationMs: 0,
  };
  await finishAttempt({ ctx, ended });
};

const recoverChildren = async (params: ClaimedParams): Promise<void> => {
  const { ctx, tree, watchers, sleep, maxPolls } = params;
  const attempts = await listLiveAutoAttempts({ db: ctx.db, treeId: tree.id });
  for (const attempt of attempts) {
    const delegation = await getAutoDelegation({ db: ctx.db, delegationId: attempt.delegationId });
    if (delegation === null) {
      continue;
    }
    let current = attempt;
    if (attempt.state === 'starting' && attempt.runId === null) {
      const run = await ctx.ports.lookupDeliveryRun({ deliveryId: attempt.id });
      if (run === null) {
        continue;
      }
      await ctx.scheduler.markAttemptRunning({
        attemptId: attempt.id,
        delegationId: delegation.id,
        generation: tree.generation,
        runId: run.runId,
      });
      current = { ...attempt, state: 'running', runId: run.runId };
    }
    const runId = current.runId;
    if (runId === null) {
      continue;
    }
    const run = { runId, agentId: delegation.childAgentId, sessionId: tree.sessionId };
    const isLive = await ctx.ports.isRunLive({ runId });
    if (!isLive) {
      await closeChild({
        ctx,
        tree,
        attempt: current,
        outcome: await ctx.ports.readRunOutcome(run),
      });
      continue;
    }
    watchers.push(
      watchRun({ ports: ctx.ports, run, sleep, maxPolls }).then(async (watched) => {
        if (watched.kind === 'gone') {
          await closeChild({ ctx, tree, attempt: current, outcome: watched.outcome });
        }
      }),
    );
  }
};

const recoverLandings = async ({ ctx, tree }: ClaimedParams): Promise<void> => {
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId: tree.id });
  for (const delegation of open) {
    if (delegation.reviseOf === null) {
      continue;
    }
    const attempts = await listAutoAttemptsOfDelegation({
      db: ctx.db,
      delegationId: delegation.id,
    });
    const latest = attempts[attempts.length - 1];
    if (latest === undefined || latest.state !== 'ended' || latest.outcome !== 'completed') {
      continue;
    }
    await landAttemptRevision({
      ctx,
      sessionId: tree.sessionId,
      delegation,
      attempt: latest,
      generation: tree.generation,
    });
  }
};

type PublishesParams = {
  readonly ctx: AgentVerbContext;
  readonly treeId: AutoTree['id'];
};

const recoverPublishes = async ({ ctx, treeId }: PublishesParams): Promise<void> => {
  const attempts = await listAutoAttemptsOfTree({ db: ctx.db, treeId });
  for (const attempt of attempts) {
    if (attempt.state === 'ended') {
      await pushSettledPublish({ ctx, attemptId: attempt.id });
    }
  }
};

export const recoverTree = async ({
  ctx,
  treeId,
  sleep,
  maxPolls,
}: RecoverParams): Promise<RecoverOutcome> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  if (!isOwner) {
    return { kind: 'idle', reason: 'not_owner' };
  }
  const tree = await getAutoTree({ db: ctx.db, treeId });
  if (tree === null) {
    return { kind: 'idle', reason: 'no_tree' };
  }
  await recoverPublishes({ ctx, treeId });
  if (tree.stopState === 'requested' || tree.stopState === 'confirming') {
    await stopTree({ ctx, treeId });
    return { kind: 'recovered', watchers: [] };
  }
  const watchers: Watchers = [];
  const params: ClaimedParams = { ctx, tree, watchers, sleep, maxPolls };
  await recoverClaimedRows(params);
  await recoverAutoTurn(params);
  const fresh = await getAutoTree({ db: ctx.db, treeId });
  if (fresh !== null) {
    const next: ClaimedParams = { ...params, tree: fresh };
    await recoverChildren(next);
    await recoverLandings(next);
  }
  return { kind: 'recovered', watchers };
};
