import { providerFlags } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly providerId: ProviderId;
};

export const canTestConnection = ({ providerId }: Params): boolean =>
  providerFlags({ id: providerId }).hasAccountTest;
