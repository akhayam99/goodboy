import { claimPrWrite } from './claimPrWrite';
import { notePrWrite } from './notePrWrite';
import { releasePrWrite } from './releasePrWrite';
import { prWritesInitialState } from './state';
import { sweepPrWriteClaims } from './sweepPrWriteClaims';
import type { GetFn, PrWritesSlice, SetFn } from './types';

export const createPrWritesSlice = (set: SetFn, get: GetFn): PrWritesSlice => ({
  ...prWritesInitialState,
  claimPrWrite: claimPrWrite(set, get),
  releasePrWrite: releasePrWrite(set, get),
  notePrWrite: notePrWrite(set),
  sweepPrWriteClaims: sweepPrWriteClaims(set),
});
