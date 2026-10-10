import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  INITIAL_HEALTH,
  type ProviderHealth,
} from '../../../store/slices/providers/providerHealth';

type Params = {
  readonly providerId: ProviderId;
};

export const useProviderHealth = ({ providerId }: Params): ProviderHealth =>
  useAppStore((state) => state.providerHealth?.[providerId] ?? INITIAL_HEALTH);
