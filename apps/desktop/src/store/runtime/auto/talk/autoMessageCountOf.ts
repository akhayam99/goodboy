import { listAgentQueuedMessages, listAutoDelegations, type AutoDelegation } from '@goodboy/db';
import { AUTO_MESSAGE_QUEUE_PREFIX } from '../../../../features/auto/AUTO_MESSAGE_QUEUE_PREFIX';
import { delegationContinueOf } from '../../../../features/auto/delegationContinueOf';
import type { AgentVerbContext } from '../verbContext';

export type AutoMessageCountParams = Readonly<{
  ctx: AgentVerbContext;
  delegation: Pick<AutoDelegation, 'treeId' | 'childAgentId'>;
}>;

export const autoMessageCountOf = async ({
  ctx,
  delegation,
}: AutoMessageCountParams): Promise<number> => {
  const queued = await listAgentQueuedMessages(ctx.db, [delegation.childAgentId]);
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: delegation.treeId });
  const delivered = delegations.filter(
    (row) =>
      row.childAgentId === delegation.childAgentId &&
      delegationContinueOf({ delegation: row })?.from === 'auto-message',
  );
  return (
    queued.filter((row) => row.id.startsWith(AUTO_MESSAGE_QUEUE_PREFIX)).length + delivered.length
  );
};
