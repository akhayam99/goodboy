import type { SendTurnResult, TurnRefusal } from '../types';

type Params = {
  readonly result: SendTurnResult;
};

export const turnRefusalOf = ({ result }: Params): TurnRefusal | null => {
  if (result.blockedOverBudget) {
    return 'provider_limit';
  }
  if (result.isWriterLeaseDenied === true) {
    return 'folder_busy';
  }
  return result.autoChildRefusal ?? null;
};
