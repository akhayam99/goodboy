import type { CandidateCause, CandidateList } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';

type Params = {
  readonly list: CandidateList;
  readonly provider: ProviderId | string;
};

export const providerCauseOf = ({ list, provider }: Params): CandidateCause | null => {
  if (!isProviderId(provider)) {
    return 'unknown-model';
  }
  const rows = list.rows.filter((row) => row.provider === provider);
  if (rows.some((row) => row.cause === null)) {
    return null;
  }
  return (
    rows.find((row) => row.cause !== null)?.cause ??
    list.excluded.find((entry) => entry.provider === provider)?.cause ??
    null
  );
};
