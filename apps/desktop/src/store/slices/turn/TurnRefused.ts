import type { TurnRefusal } from './types';
import { turnRefusalMessage } from './turnRefusalMessage';

type Params = {
  readonly refusal: TurnRefusal;
};

export class TurnRefused extends Error {
  readonly refusal: TurnRefusal;

  constructor({ refusal }: Params) {
    super(turnRefusalMessage({ refusal }));
    this.name = 'TurnRefused';
    this.refusal = refusal;
  }
}
