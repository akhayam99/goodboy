import type { AutoDelegation } from '@goodboy/db';
import { PROVIDER_IDS } from '@goodboy/types';
import type { StartChildTurnParams } from '../../../runtime/auto/ports';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'routing'>;
};

export const routedModelOf = ({
  delegation,
}: Params): Pick<StartChildTurnParams, 'routedModel'> => {
  const providerText = delegation.routing['provider'];
  const model = delegation.routing['model'];
  const provider = PROVIDER_IDS.find((candidate) => candidate === providerText);
  if (provider === undefined || typeof model !== 'string' || model === '') {
    return {};
  }
  return { routedModel: { provider, model } };
};
