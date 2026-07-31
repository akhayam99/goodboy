import { useEffect, useState } from 'react';
import { Dialog } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { ProviderConnectDialog } from './ProviderConnectDialog';

type Props = {
  readonly providerId: ProviderId | null;
  readonly initialAction: ProviderLifecycleAction;
  readonly onClose: () => void;
};

export const ProviderConnectModal = ({ providerId, initialAction, onClose }: Props) => {
  const open = providerId !== null;
  const [pinned, setPinned] = useState<ProviderId | null>(null);
  const [pinnedAction, setPinnedAction] = useState<ProviderLifecycleAction>(initialAction);

  useEffect(() => {
    if (providerId) {
      setPinned(providerId);
      setPinnedAction(initialAction);
    }
  }, [providerId, initialAction]);

  const target = providerId ?? pinned;
  if (!target) {
    return (
      <Dialog open={false} onClose={onClose} size="xl">
        {null}
      </Dialog>
    );
  }
  return (
    <ProviderConnectDialog
      providerId={target}
      action={pinnedAction}
      open={open}
      onClose={onClose}
    />
  );
};
