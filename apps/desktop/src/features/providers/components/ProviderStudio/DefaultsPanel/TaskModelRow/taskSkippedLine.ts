import { providerStanding, type ProviderCandidatesContext } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';
import { skippedPinLine } from '../skippedPinLine';

type Params = {
  readonly preference: TaskModelPreference | null;
  readonly using: TaskModelPreference;
  readonly context: ProviderCandidatesContext;
};

export const taskSkippedLine = ({ preference, using, context }: Params): string | null => {
  if (preference === null) {
    return null;
  }
  const standing = providerStanding({ provider: preference.providerId, context });
  if (standing !== 'off' && standing !== 'not-connected') {
    return null;
  }
  return skippedPinLine({
    pinned: { provider: preference.providerId, model: preference.model },
    using: { provider: using.providerId, model: using.model },
    standing,
  });
};
