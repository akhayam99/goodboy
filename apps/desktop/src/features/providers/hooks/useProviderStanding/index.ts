import { limitsChipOf, providerStanding, type ProviderStanding } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatLimitReset } from '../../limits/formatLimitReset';

type Params = {
  readonly provider: ProviderId;
};

export type ProviderStandingNote = Readonly<{
  standing: ProviderStanding;
  text: string;
}>;

const STANDING_TEXT: Readonly<Record<Exclude<ProviderStanding, 'usable' | 'at-limit'>, string>> = {
  'not-connected': 'Not connected',
  off: 'Off in this workspace',
  backup: 'Backup only',
};

export const useProviderStanding = ({ provider }: Params): ProviderStandingNote | null => {
  const policy = useAppStore((state) =>
    state.currentWorkspaceId == null
      ? null
      : (state.workspaceOverrides?.[state.currentWorkspaceId]?.providerPool ?? null),
  );
  const connection = useAppStore(
    (state) => state.providers.find((candidate) => candidate.id === provider)?.connection ?? null,
  );
  const limits = useAppStore((state) => state.providerLimits?.[provider]);
  const nowMs = useNow(60_000);
  const chip = limitsChipOf({ providerId: provider, limits, nowMs });
  const standing = providerStanding({
    provider,
    context: {
      defaultProvider: provider,
      connected: connection === 'connected' ? [provider] : [],
      atLimit: chip.state === 'out' ? [provider] : [],
      policy,
    },
  });
  if (standing === 'usable') {
    return null;
  }
  if (standing !== 'at-limit') {
    return { standing, text: STANDING_TEXT[standing] };
  }
  const until = chip.resetsAt === null ? '' : formatLimitReset({ iso: chip.resetsAt, nowMs });
  return { standing, text: until === '' ? 'At limit' : `At limit until ${until}` };
};
