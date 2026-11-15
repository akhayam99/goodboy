import { isApiProvider } from '@goodboy/core/providers';
import { useAppStore } from '../../../../store';
import { INITIAL_HEALTH_MAP } from '../../../../store/slices/providers/providerHealth';
import { useProviderLimitsChip } from '../../hooks/useProviderLimitsChip';
import { providerRailStatus } from '../../providerRailStatus';
import type { ProviderDisplayInfo } from '../../providers';
import { providerStateWord, type ProviderStateWord } from '../providerStateWord';

type Params = {
  readonly info: ProviderDisplayInfo;
  readonly isReady: boolean;
};

export const useProviderStateWord = ({ info, isReady }: Params): ProviderStateWord => {
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const health = useAppStore((state) => state.providerHealth[info.id]);
  const { chip, nowMs } = useProviderLimitsChip({ providerId: info.id });
  const rail = providerRailStatus({
    provider: info,
    state: {
      cliRequirements,
      ...(health !== undefined && { providerHealth: { ...INITIAL_HEALTH_MAP, [info.id]: health } }),
    },
    nowMs,
    isLimitIgnored: true,
  });
  return providerStateWord({
    info,
    isApi: isApiProvider({ id: info.id }),
    isReady,
    rail,
    limitState: chip.state,
  });
};
