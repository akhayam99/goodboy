import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo, ProviderStatus } from '../../providers/providers';

type Params = {
  readonly id: ProviderId;
  readonly info: ProviderDisplayInfo | null;
};

export const statusOfInfo = ({ id, info }: Params): ProviderStatus | null => {
  if (info === null || info.connection === 'unknown') {
    return null;
  }
  return {
    id,
    binary: info.binary,
    available: info.version !== null && info.version !== undefined,
    version: info.version ?? null,
    error: info.error,
  };
};
