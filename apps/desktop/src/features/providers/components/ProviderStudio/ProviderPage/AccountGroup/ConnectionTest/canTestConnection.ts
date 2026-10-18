import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly providerId: ProviderId;
};

export const canTestConnection = ({ providerId }: Params): boolean =>
  providerId === 'anthropic' || providerId === 'codex' || providerId === 'cursor';
