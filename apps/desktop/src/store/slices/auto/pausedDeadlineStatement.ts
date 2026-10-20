import { AUTO_DELEGATION_DEADLINE_MINUTES } from '@goodboy/core';
import type { AutoTree, Statement } from '@goodboy/db';

export type PausedDeadlineStatementParams = Readonly<{
  treeId: AutoTree['id'];
  nowMs: number;
}>;

export const pausedDeadlineStatement = ({
  treeId,
  nowMs,
}: PausedDeadlineStatementParams): Statement => ({
  sql: `UPDATE auto_delegations SET deadline_at = MAX(deadline_at, ?)
    WHERE tree_id = ? AND state = 'paused'`,
  params: [nowMs + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000, treeId],
});
