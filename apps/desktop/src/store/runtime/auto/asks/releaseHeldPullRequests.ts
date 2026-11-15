import { pullRequestOfResult } from '@goodboy/core/auto';
import { getAutoDelegation, listAutoDelegations } from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import type { PublishRowResult } from '../../../../features/auto/publishPort';
import type { AgentVerbContext } from '../verbContext';
import { openOrHoldPullRequest } from './openOrHoldPullRequest';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly rows: ReadonlyArray<PublishRowResult>;
};

type RowParams = {
  readonly ctx: AgentVerbContext;
  readonly row: PublishRowResult;
};

const releaseOne = async ({ ctx, row }: RowParams): Promise<void> => {
  const pushed = await getAutoDelegation({
    db: ctx.db,
    delegationId: brandId<AutoDelegationId>({ value: row.delegationId }),
  });
  const mountId = pushed?.target['mountId'];
  if (pushed === null || typeof mountId !== 'string') {
    return;
  }
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: pushed.treeId });
  for (const delegation of delegations) {
    const record = pullRequestOfResult({ result: delegation.result });
    const isHeld =
      delegation.state === 'settled' &&
      delegation.generation === pushed.generation &&
      record?.state === 'awaiting_push' &&
      record.mountId === mountId;
    if (isHeld && record !== null) {
      await openOrHoldPullRequest({ ctx, delegation, record });
    }
  }
};

export const releaseHeldPullRequests = async ({ ctx, rows }: Params): Promise<void> => {
  const answered = rows.filter((row) => row.state === 'pushed' || row.state === 'declined');
  for (const row of answered) {
    await releaseOne({ ctx, row });
  }
};
