import type { AppState } from '../../types';
import { prWriteKey } from './prWriteKey';
import type { PrWriteClaim, PrWriteTarget } from './types';

export const selectPrWrite = ({
  state,
  target,
}: {
  readonly state: Pick<AppState, 'prWriteClaims'>;
  readonly target: PrWriteTarget | null;
}): PrWriteClaim | null => {
  if (target === null) {
    return null;
  }
  return state.prWriteClaims[prWriteKey(target)] ?? null;
};
