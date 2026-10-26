import type { ProviderId } from '@goodboy/types';
import { openSettings } from '../settings/openSettings';

type Params = {
  readonly providerId: ProviderId;
};

export const openProviderCliUpdate = ({ providerId }: Params): void => {
  openSettings({ scope: 'providers', provider: providerId, action: 'update' });
};
