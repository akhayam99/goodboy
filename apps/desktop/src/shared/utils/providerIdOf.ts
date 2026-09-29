import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';

type Params = {
  readonly value: string | null;
};

export const providerIdOf = ({ value }: Params): ProviderId | null =>
  PROVIDER_IDS.find((providerId) => providerId === value) ?? null;
