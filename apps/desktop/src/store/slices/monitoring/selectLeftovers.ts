import { findLeftovers, type Leftover } from '@goodboy/core';
import type { AppStore } from '../../store';

type Input = Pick<AppStore, 'monitorSnapshot' | 'monitorLedger'>;

const NO_LEFTOVERS: ReadonlyArray<Leftover> = [];

let memo: { readonly input: Input; readonly leftovers: ReadonlyArray<Leftover> } | null = null;

export const selectLeftovers = (state: Input): ReadonlyArray<Leftover> => {
  if (
    memo !== null &&
    memo.input.monitorSnapshot === state.monitorSnapshot &&
    memo.input.monitorLedger === state.monitorLedger
  ) {
    return memo.leftovers;
  }
  if (state.monitorSnapshot === null) {
    return NO_LEFTOVERS;
  }
  const leftovers = findLeftovers({
    snapshot: state.monitorSnapshot,
    ledger: state.monitorLedger,
  });
  memo = { input: state, leftovers };
  return leftovers;
};
