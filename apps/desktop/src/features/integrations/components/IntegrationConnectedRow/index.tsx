import { useState } from 'react';
import { Chip, ConfirmPopover, ICON_SIZE, IconButton } from '@goodboy/ui';
import { TriangleAlert, Unplug } from '@goodboy/ui/icons';
import type { IntegrationCredentialId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectIntegrationKeyCheck } from '../../../../store/slices/integrations/selectIntegrationKeyCheck';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import {
  IntegrationGlyph,
  type IntegrationGlyphProvider,
} from '../../../../shared/components/IntegrationGlyph';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly primary: string;
  readonly secondary?: string;
  readonly badge?: string;
  readonly credentialId?: IntegrationCredentialId | null;
  readonly disconnectDescription: string;
  readonly hasHeaderDisconnect?: boolean;
  readonly onDisconnect: () => Promise<void>;
};

export const IntegrationConnectedRow = ({
  provider,
  primary,
  secondary,
  badge,
  credentialId = null,
  disconnectDescription,
  hasHeaderDisconnect = false,
  onDisconnect,
}: Props) => {
  const label = integrationLabel({ provider });
  const isKeyMissing = useAppStore(
    (state) =>
      provider !== 'github' &&
      selectIntegrationKeyCheck({ state, credentialId })?.isPresent === false,
  );
  const reportError = useAppStore((state) => state.reportError);
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const disconnect = async (): Promise<boolean> => {
    setIsBusy(true);
    try {
      await onDisconnect();
      return true;
    } catch (error) {
      void reportError({
        title: `Couldn't disconnect ${label}`,
        error,
        recovery: NOTHING_CHANGED,
        stays: `${label} is still connected.`,
        retry: disconnect,
      });
      return false;
    } finally {
      setIsArmed(false);
      setIsBusy(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border-soft bg-subtle px-3 py-3">
        <IntegrationGlyph provider={provider} size={ICON_SIZE.control} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-control text-foreground">{primary}</span>
          {secondary != null ? (
            <span className="truncate font-mono text-meta text-muted-foreground">{secondary}</span>
          ) : null}
        </div>
        {isKeyMissing ? <Chip kind="state" tone="danger" label="Key missing" /> : null}
        {badge != null ? <Chip kind="state" tone="neutral" bordered label={badge} /> : null}
        {hasHeaderDisconnect ? null : (
          <ConfirmPopover
            role="danger"
            icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
            title={`Disconnect ${label}?`}
            description={disconnectDescription}
            confirmLabel={`Disconnect ${label}`}
            isBusy={isBusy}
            isOpen={isArmed}
            onConfirm={async () => {
              await disconnect();
            }}
            onCancel={() => setIsArmed(false)}
            trigger={() => (
              <IconButton
                icon={Unplug}
                label={`Disconnect ${label}`}
                onClick={() => setIsArmed(true)}
                disabled={isBusy}
              />
            )}
          />
        )}
      </div>
      {isKeyMissing && !hasHeaderDisconnect ? (
        <p className="flex items-start gap-1 text-meta text-muted-foreground">
          <TriangleAlert
            size={ICON_SIZE.row}
            aria-hidden
            className="mt-0.5 shrink-0 text-warning"
          />
          <span>
            The key is missing from this Mac's keychain, so every request with it fails. Disconnect
            and connect again to paste a new one.
          </span>
        </p>
      ) : null}
    </div>
  );
};
