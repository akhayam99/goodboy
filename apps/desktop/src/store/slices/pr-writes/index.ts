import { claimPrWrite } from './claimPrWrite';
import { notePrWrite } from './notePrWrite';
import { releasePrWrite } from './releasePrWrite';
import { prWritesInitialState } from './state';
import { sweepPrWriteClaims } from './sweepPrWriteClaims';
import type { PrWritesSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createPrWritesSlice = ({ set, get }: SliceDeps): PrWritesSlice => ({
  ...prWritesInitialState,
  claimPrWrite: claimPrWrite(set, get),
  releasePrWrite: releasePrWrite(set, get),
  notePrWrite: notePrWrite(set),
  sweepPrWriteClaims: sweepPrWriteClaims(set),
});
