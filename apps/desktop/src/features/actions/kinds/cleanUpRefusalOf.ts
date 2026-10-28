import type { AfterMergeOutcome } from '../../../store/slices/branch-cleanup/types';

type Params = {
  readonly outcome: Exclude<AfterMergeOutcome, { readonly kind: 'deleted' }>;
  readonly label: string;
};

export const cleanUpRefusalOf = ({ outcome, label }: Params): string => {
  if (outcome.kind === 'kept') {
    return outcome.keptBecause;
  }
  if (outcome.kind === 'ask' && outcome.keptBecause !== null) {
    return outcome.keptBecause;
  }
  return `Kept ${label}: Goodboy couldn't check it is safe to remove.`;
};
