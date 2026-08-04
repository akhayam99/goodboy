import { useEffect, useState } from 'react';
import { Dialog } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { ProviderConnectDialog } from './ProviderConnectDialog';

type Props = {
  readonly providerId: ProviderId | null;
  readonly onClose: () => void;
};

export const ProviderConnectModal = ({ providerId, onClose }: Props) => {
  const open = providerId !== null;
  const [pinned, setPinned] = useState<ProviderId | null>(null);

  useEffect(() => {
    if (providerId === null) {
      return;
    }
    setPinned(providerId);
  }, [providerId]);

  const target = providerId ?? pinned;
  if (target === null) {
    return (
      <Dialog open={false} onClose={onClose} size="lg">
        {null}
      </Dialog>
    );
  }
  return <ProviderConnectDialog providerId={target} open={open} onClose={onClose} />;
};
