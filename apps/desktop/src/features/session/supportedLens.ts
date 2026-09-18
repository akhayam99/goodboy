import type { LensKind } from '../../store';
import { SIMPLE_LENSES } from './lens-labels';

type Params = Readonly<{
  lens: LensKind | null;
  isBranchless: boolean;
}>;

export const supportedLens = ({ lens, isBranchless }: Params): LensKind | null =>
  isBranchless && lens != null && !SIMPLE_LENSES.has(lens) ? null : lens;
