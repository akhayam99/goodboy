import type { StateTone } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { useAppStore } from '../../../../store';
import { INITIAL_HEALTH_MAP } from '../../../../store/slices/providers/providerHealth';
import { connectionStateOf } from '../../../connections/model/connectionStateOf';
import type { ProviderDisplayInfo } from '../../providers';

type Params = {
  readonly info: ProviderDisplayInfo;
};

type ProviderStateWord = {
  readonly word: string;
  readonly tone: StateTone;
};

const CLOCK_MS = 60_000;

export const useProviderStateWord = ({ info }: Params): ProviderStateWord => {
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const health = useAppStore((state) => state.providerHealth[info.id]);
  const limits = useAppStore((state) => state.providerLimits[info.id]);
  const nowMs = useNow(CLOCK_MS);
  const { word, tone } = connectionStateOf({
    subject: {
      kind: 'provider',
      provider: info,
      state: {
        cliRequirements,
        providerLimits: { [info.id]: limits },
        ...(health !== undefined && {
          providerHealth: { ...INITIAL_HEALTH_MAP, [info.id]: health },
        }),
      },
      nowMs,
    },
  });
  return { word, tone: tone ?? 'neutral' };
};
