import { listAutoDelegations, type AutoTree } from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';
import type { RoutedModelRef } from '../ports';
import type { AgentVerbContext } from '../verbContext';

type Params = {
  readonly ctx: Pick<AgentVerbContext, 'db'>;
  readonly tree: Pick<AutoTree, 'id'>;
};

export const notedNoAccessOf = async ({
  ctx,
  tree,
}: Params): Promise<ReadonlyArray<RoutedModelRef>> => {
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  return delegations.flatMap((delegation): ReadonlyArray<RoutedModelRef> => {
    if (textFieldOf({ source: delegation.routing, key: 'cause' }) !== 'no-access') {
      return [];
    }
    const requested: unknown = delegation.routing['requested'];
    if (!isRecord(requested)) {
      return [];
    }
    const provider = textFieldOf({ source: requested, key: 'provider' });
    const model = textFieldOf({ source: requested, key: 'model' });
    return provider === null || model === null ? [] : [{ provider, model }];
  });
};
