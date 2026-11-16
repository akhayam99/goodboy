import type { ProviderId } from '@goodboy/types';
import { openConnection } from '../connections/openConnection';
import { USAGE_SECTION } from './components/ProviderStudio/ProviderPage/UsageGroup/usageSectionId';

type Params = {
  readonly providerId: ProviderId | null;
};

export const openProviderUsage = ({ providerId }: Params): void => {
  openConnection({
    focus:
      providerId === null
        ? null
        : { kind: 'provider', provider: providerId, section: USAGE_SECTION },
  });
};
