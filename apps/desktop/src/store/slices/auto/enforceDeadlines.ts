import {
  getAutoTree,
  listOpenAutoDelegations,
  listAutoAttemptsOfDelegation,
  type AutoAttempt,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import { failAttempt } from './failAttempt';
import type { AgentVerbContext } from './verbContext';

export type EnforceDeadlinesParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

const REASON = 'deadline_passed';

type ExpireParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
};

const expirePaused = async ({ ctx, tree, delegation, attempt }: ExpireParams): Promise<boolean> => {
  const nowMs = ctx.now();
  const outcome = await ctx.db.transaction({
    statements: [
      {
        sql: `UPDATE auto_attempts
          SET state = 'ended', outcome = 'timed_out', end_reason = ?, ended_at = ?
          WHERE id = ? AND generation = ? AND state = 'paused'`,
        params: [REASON, nowMs, attempt.id, tree.generation],
        abortWhen: 'noChanges',
        abortCode: 'expire_paused',
      },
      {
        sql: `UPDATE auto_outbox SET state = 'dropped', dropped_reason = ?
          WHERE tree_id = ? AND join_key = ? AND state = 'pending'`,
        params: [REASON, tree.id, `question:${attempt.id}`],
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
}: ExpireParams): Promise<boolean> => {
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
    reason: REASON,
    outcome: 'timed_out',
    costUsd: null,
  });
  return settled.kind === 'settled';
};

export const enforceDeadlines = async ({
  ctx,
  treeId,
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
    const isExpired = delegation.deadlineAt <= nowMs;
    const isLive =
      delegation.state === 'starting' ||
      delegation.state === 'running' ||
      delegation.state === 'paused';
    if (!isExpired || !isLive) {
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
    const hasChanged =
      attempt.state === 'paused' ? await expirePaused(params) : await expireRunning(params);
    hasActed = hasActed || hasChanged;
  }
  return hasActed;
};
