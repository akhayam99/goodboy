import { AUTO_CHILD_IDLE_MINUTES } from '@goodboy/core/auto';
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

const IDLE_REASON = 'no_activity';
const IDLE_MS = AUTO_CHILD_IDLE_MINUTES * 60_000;

type ExpireParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
};

type IdleParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly watchedSinceMs: number;
  readonly nowMs: number;
};

const expireSilent = async ({ ctx, tree, delegation, attempt }: ExpireParams): Promise<boolean> => {
  const cancelled = await ctx.ports.cancelRun({
    sessionId: tree.sessionId,
    agentId: delegation.childAgentId,
    by: 'auto',
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
    reason: IDLE_REASON,
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
  if (nowMs - watchedSinceMs < IDLE_MS) {
    return false;
  }
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId });
  let hasActed = false;
  for (const delegation of open) {
    if (delegation.state !== 'starting' && delegation.state !== 'running') {
      continue;
    }
    const attempts = await listAutoAttemptsOfDelegation({
      db: ctx.db,
      delegationId: delegation.id,
    });
    const attempt = attempts[attempts.length - 1];
    if (attempt === undefined || attempt.state === 'paused') {
      continue;
    }
    if (!(await isIdle({ ctx, delegation, attempt, watchedSinceMs, nowMs }))) {
      continue;
    }
    hasActed = (await expireSilent({ ctx, tree, delegation, attempt })) || hasActed;
  }
  return hasActed;
};
