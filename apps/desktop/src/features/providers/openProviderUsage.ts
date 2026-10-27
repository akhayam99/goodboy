import type { ProviderId } from '@goodboy/types';
import { openSettings } from '../settings/openSettings';

type Params = {
  readonly providerId: ProviderId | null;
};

export const openProviderUsage = ({ providerId }: Params): void => {
  openSettings(
    providerId === null
      ? { scope: 'providers', door: true }
      : { scope: 'providers', provider: providerId, section: 'usage', door: true },
  );
};
