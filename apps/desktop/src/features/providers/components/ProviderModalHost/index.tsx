import { useCallback, useEffect, useState } from 'react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { ProviderConnectModal } from '../ProviderConnectModal';

export type OpenProviderModalDetail = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
};

const OPEN_PROVIDER_MODAL_EVENT = 'goodboy:open-provider-modal';

export const ProviderModalHost = () => {
  const [open, setOpen] = useState<OpenProviderModalDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenProviderModalDetail>).detail;
      if (!detail) return;
      setOpen(detail);
    };
    window.addEventListener(OPEN_PROVIDER_MODAL_EVENT, handler);
    return () => window.removeEventListener(OPEN_PROVIDER_MODAL_EVENT, handler);
  }, []);

  const onClose = useCallback(() => setOpen(null), []);

  return (
    <ProviderConnectModal
      providerId={open?.providerId ?? null}
      initialAction={open?.action ?? 'install'}
      onClose={onClose}
    />
  );
};

export const openProviderModal = (detail: OpenProviderModalDetail): void => {
  window.dispatchEvent(
    new CustomEvent<OpenProviderModalDetail>(OPEN_PROVIDER_MODAL_EVENT, { detail }),
  );
};
