import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo, ProviderStatus } from './providers';

type Params = {
  readonly id: ProviderId;
  readonly info: ProviderDisplayInfo | null;
};

const hasProbeEvidence = ({ info }: Pick<Params, 'info'>): boolean => {
  if (info === null) {
    return false;
  }
  return (
    info.connection !== 'unknown' ||
    (info.version !== null && info.version !== undefined) ||
    info.error !== null ||
    (info.errorKind !== undefined && info.errorKind !== null)
  );
};

export const statusOfInfo = ({ id, info }: Params): ProviderStatus | null => {
  if (info === null || !hasProbeEvidence({ info })) {
    return null;
  }
  return {
    id,
    binary: info.binary,
    available: info.version !== null && info.version !== undefined,
    version: info.version ?? null,
    error: info.error,
    ...(info.errorKind !== undefined && info.errorKind !== null && { errorKind: info.errorKind }),
  };
};
