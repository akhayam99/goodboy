import { useCallback, useEffect, useState } from 'react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { ProviderConnectModal } from '../ProviderConnectModal';

export interface OpenProviderModalDetail {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
}

// Implementation detail of openProviderModal() below. Not exported because
// callers should use the helper, not dispatch raw CustomEvents.
const OPEN_PROVIDER_MODAL_EVENT = 'goodboy:open-provider-modal';

/**
 * App-level mount point for the provider connect modal. Listens for an
 * `OPEN_PROVIDER_MODAL_EVENT` CustomEvent so any surface can request the
 * modal (the tile in ProvidersPanel, the chat AuthRequiredCallout, future
 * onboarding cards) without prop-drilling state through the tree.
 *
 * Event detail: `{ providerId, action }`. Dispatch with
 * `window.dispatchEvent(new CustomEvent(OPEN_PROVIDER_MODAL_EVENT,
 *   { detail: { providerId, action } }))`.
 */
export function ProviderModalHost() {
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
}

// Convenience dispatcher so callers do not have to remember the event name
// or detail shape. Imported by the tile, the chat callout, and any other
// surface that wants to summon the modal.
export function openProviderModal(detail: OpenProviderModalDetail): void {
  window.dispatchEvent(
    new CustomEvent<OpenProviderModalDetail>(OPEN_PROVIDER_MODAL_EVENT, { detail }),
  );
}
