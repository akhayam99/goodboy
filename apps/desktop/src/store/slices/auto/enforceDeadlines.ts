import { AUTO_CHILD_IDLE_MINUTES } from '@goodboy/core';
import {
  getAutoTree,
  hasAgentOpenToolCall,
  listOpenAutoDelegations,
  listAutoAttemptsOfDelegation,
  readAgentLastEventAt,
  type AutoAttempt,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import { failAttempt } from './failAttempt';
import type { AgentVerbContext } from './verbContext';

export type EnforceDeadlinesParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
  watchedSinceMs: number;
}>;

const DEADLINE_REASON = 'deadline_passed';
const IDLE_REASON = 'no_activity';
const IDLE_MS = AUTO_CHILD_IDLE_MINUTES * 60_000;

type ExpireParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
};

type ExpireRunningParams = ExpireParams & {
  readonly reason: string;
};

type IdleParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly watchedSinceMs: number;
  readonly nowMs: number;
};

const expirePaused = async ({ ctx, tree, delegation, attempt }: ExpireParams): Promise<boolean> => {
  const nowMs = ctx.now();
  const outcome = await ctx.db.transaction({
    statements: [
      {
        sql: `UPDATE auto_attempts
          SET state = 'ended', outcome = 'timed_out', end_reason = ?, ended_at = ?
          WHERE id = ? AND generation = ? AND state = 'paused'`,
        params: [DEADLINE_REASON, nowMs, attempt.id, tree.generation],
        abortWhen: 'noChanges',
        abortCode: 'expire_paused',
      },
      {
        sql: `UPDATE auto_outbox SET state = 'dropped', dropped_reason = ?
          WHERE tree_id = ? AND join_key = ? AND state = 'pending'`,
        params: [DEADLINE_REASON, tree.id, `question:${attempt.id}`],
      },
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, tree.id],
      },
    ],
  });
  return outcome.status === 'committed' && delegation.state === 'paused';
};

const expireRunning = async ({
  ctx,
  tree,
  delegation,
  attempt,
  reason,
}: ExpireRunningParams): Promise<boolean> => {
  const cancelled = await ctx.ports.cancelRun({
    sessionId: tree.sessionId,
    agentId: delegation.childAgentId,
  });
  if (cancelled.outcome !== 'exited') {
    await ctx.db.execute(
      `UPDATE auto_delegations SET is_stopping = 1 WHERE id = ? AND state <> 'settled'`,
      [delegation.id],
    );
    return false;
  }
  const settled = await failAttempt({
    ctx,
    delegation,
    attempt,
    generation: tree.generation,
    reason,
    outcome: 'timed_out',
    costUsd: null,
  });
  return settled.kind === 'settled';
};

const isIdle = async ({
  ctx,
  delegation,
  attempt,
  watchedSinceMs,
  nowMs,
}: IdleParams): Promise<boolean> => {
  const quietSince = Math.max(attempt.startedAt, watchedSinceMs);
  if (nowMs - quietSince < IDLE_MS) {
    return false;
  }
  const lastEventAt = await readAgentLastEventAt({
    db: ctx.db,
    agentId: delegation.childAgentId,
    sinceMs: quietSince,
  });
  if (lastEventAt !== null && nowMs - lastEventAt < IDLE_MS) {
    return false;
  }
  return !(await hasAgentOpenToolCall({
    db: ctx.db,
    agentId: delegation.childAgentId,
    sinceMs: attempt.startedAt,
  }));
};

export const enforceDeadlines = async ({
  ctx,
  treeId,
  watchedSinceMs,
}: EnforceDeadlinesParams): Promise<boolean> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  const tree = isOwner ? await getAutoTree({ db: ctx.db, treeId }) : null;
  if (tree === null || tree.stopState !== 'none') {
    return false;
  }
  const nowMs = ctx.now();
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId });
  let hasActed = false;
  for (const delegation of open) {
    const isDeadlinePassed = delegation.deadlineAt <= nowMs;
    const isPausedDelegation = delegation.state === 'paused';
    const isWorking = delegation.state === 'starting' || delegation.state === 'running';
    if (!isWorking && !isPausedDelegation) {
      continue;
    }
    if (isPausedDelegation && (!isDeadlinePassed || tree.phase === 'blocked')) {
      continue;
    }
    if (isWorking && !isDeadlinePassed && nowMs - watchedSinceMs < IDLE_MS) {
      continue;
    }
    const attempts = await listAutoAttemptsOfDelegation({
      db: ctx.db,
      delegationId: delegation.id,
    });
    const attempt = attempts[attempts.length - 1];
    if (attempt === undefined) {
      continue;
    }
    const params = { ctx, tree, delegation, attempt };
    if (attempt.state === 'paused') {
      if (!isDeadlinePassed || tree.phase === 'blocked') {
        continue;
      }
      hasActed = (await expirePaused(params)) || hasActed;
      continue;
    }
    if (isPausedDelegation) {
      hasActed = (await expireRunning({ ...params, reason: DEADLINE_REASON })) || hasActed;
      continue;
    }
    if (!(await isIdle({ ctx, delegation, attempt, watchedSinceMs, nowMs }))) {
      continue;
    }
    hasActed = (await expireRunning({ ...params, reason: IDLE_REASON })) || hasActed;
  }
  return hasActed;
};
