import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useLimitsChips } from '../../../../features/providers/hooks/useLimitsChips';
import { openProviderUsage } from '../../../../features/providers/openProviderUsage';
import { LimitsProvidersMenu } from './LimitsProvidersMenu';
import { LimitsToolbar } from './LimitsToolbar';

type Props = {
  readonly openProviderId?: ProviderId | null;
  readonly opensProvidersMenu?: boolean;
};

export const LimitsStrip = ({ openProviderId = null, opensProvidersMenu = false }: Props) => {
  const { chips, nowMs } = useLimitsChips();
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  if (opensProvidersMenu && workspaceId !== null) {
    return <LimitsProvidersMenu workspaceId={workspaceId} chips={chips} nowMs={nowMs} />;
  }
  if (chips.length === 0) {
    return null;
  }
  return (
    <LimitsToolbar
      chips={chips}
      nowMs={nowMs}
      pressedId={openProviderId}
      onOpen={(chip) => openProviderUsage({ providerId: chip.providerId })}
    />
  );
};
