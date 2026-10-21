import { PROVIDER_LABEL } from '../providers/providerLabel';
import { PROVIDER_IDS } from './components/spend/lib';

type ProviderLabelParams = {
  readonly provider: string;
};

export const providerLabel = ({ provider }: ProviderLabelParams): string => {
  const id = PROVIDER_IDS.find((candidate) => candidate === provider);
  return id === undefined ? provider : PROVIDER_LABEL[id];
};
