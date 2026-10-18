import { useState } from 'react';
import { Chip, ConfirmPopover, formatError, IconButton } from '@goodboy/ui';
import { TriangleAlert, Unplug } from 'lucide-react';
import type { IntegrationCredentialId } from '@goodboy/types';
import { useCredentialSecret } from '../../useCredentialSecret';
import { toolHealthOf } from '../../toolHealthOf';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../IntegrationGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
  const secret = useCredentialSecret({ credentialId });
  const health = toolHealthOf({ tool: provider, isConnected: true, secret });
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onDisconnect();
      setIsArmed(false);
    } catch (disconnectError) {
      setError(formatError(disconnectError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border-soft bg-subtle px-3 py-3">
        <IntegrationGlyph provider={provider} size={ICON_SIZE.control} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-label font-medium text-foreground">{primary}</span>
          {secondary != null ? (
            <span className="truncate font-mono text-meta text-muted-foreground">{secondary}</span>
          ) : null}
        </div>
        {health.chip === null ? null : <Chip tone="danger" size="xs" label={health.chip} />}
        {badge != null ? <Chip tone="neutral" size="xs" bordered label={badge} /> : null}
        {hasHeaderDisconnect ? null : (
          <ConfirmPopover
            role="danger"
            icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
            title={`Disconnect ${label}?`}
            description={disconnectDescription}
            confirmLabel={`Disconnect ${label}`}
            isBusy={isBusy}
            isOpen={isArmed}
            onConfirm={disconnect}
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
      {health.signal === 'danger' && !hasHeaderDisconnect ? (
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
      {error != null ? <p className="text-meta text-danger">{error}</p> : null}
    </div>
  );
};
