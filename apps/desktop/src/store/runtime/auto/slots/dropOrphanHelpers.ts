import { substepLinkOf } from '@goodboy/core/auto';
import type { AutoDelegation, Database } from '@goodboy/db';

type Params = {
  readonly db: Database;
  readonly open: ReadonlyArray<AutoDelegation>;
  readonly nowMs: number;
};

const ORPHAN_REASON = 'parent_ended';

export const dropOrphanHelpers = async ({
  db,
  open,
  nowMs,
}: Params): Promise<ReadonlyArray<AutoDelegation>> => {
  const pausedIds = new Set<string>(
    open.filter((delegation) => delegation.state === 'paused').map((delegation) => delegation.id),
  );
  const orphans = open.filter((delegation) => {
    const parent = substepLinkOf({ request: delegation.request });
    return (
      delegation.state === 'accepted' && parent !== null && !pausedIds.has(parent.delegationId)
    );
  });
  for (const orphan of orphans) {
    await db.execute(
      `UPDATE auto_delegations
        SET state = 'settled', outcome = 'stopped', reason = ?, settled_at = ?
        WHERE id = ? AND state = 'accepted'`,
      [ORPHAN_REASON, nowMs, orphan.id],
    );
  }
  const dropped = new Set(orphans.map((orphan) => orphan.id));
  return open.filter((delegation) => !dropped.has(delegation.id));
};
