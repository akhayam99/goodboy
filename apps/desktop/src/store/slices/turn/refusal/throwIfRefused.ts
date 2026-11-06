import type { SendTurnResult } from '../types';
import { TurnRefused } from './TurnRefused';
import { turnRefusalOf } from './turnRefusalOf';

type Params = {
  readonly result: SendTurnResult;
};

export const throwIfRefused = ({ result }: Params): SendTurnResult => {
  const refusal = turnRefusalOf({ result });
  if (refusal !== null) {
    throw new TurnRefused({ refusal });
  }
  return result;
};
