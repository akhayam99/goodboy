import { useState } from 'react';
import { Chip, formatError, IconButton, InlineConfirm } from '@goodboy/ui';
import { TriangleAlert, Unplug } from 'lucide-react';
import type { IntegrationCredentialId } from '@goodboy/types';
import { useCredentialSecret } from '../../useCredentialSecret';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly primary: string;
  readonly secondary?: string;
  readonly badge?: string;
  readonly credentialId?: IntegrationCredentialId | null;
  readonly disconnectDescription: string;
  readonly onDisconnect: () => Promise<void>;
};

export const IntegrationConnectedRow = ({
  provider,
  primary,
  secondary,
  badge,
  credentialId = null,
  disconnectDescription,
  onDisconnect,
}: Props) => {
  const label = integrationLabel({ provider });
  const secret = useCredentialSecret({ credentialId });
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
      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border-soft bg-subtle/40 px-3 py-2.5">
        <IntegrationGlyph provider={provider} size={16} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium text-foreground">{primary}</span>
          {secondary != null ? (
            <span className="truncate font-mono text-2xs text-muted-foreground">{secondary}</span>
          ) : null}
        </div>
        {badge != null ? <Chip tone="neutral" size="xs" bordered label={badge} /> : null}
        {isArmed ? null : (
          <IconButton
            icon={Unplug}
            label={`Disconnect ${label}`}
            onClick={() => setIsArmed(true)}
            disabled={isBusy}
          />
        )}
      </div>
      {isArmed ? (
        <InlineConfirm
          role="danger"
          icon={<Unplug size={12} aria-hidden />}
          title={`Disconnect ${label}?`}
          description={disconnectDescription}
          confirmLabel={`Disconnect ${label}`}
          autoDisarmMs={4000}
          isBusy={isBusy}
          onConfirm={disconnect}
          onCancel={() => setIsArmed(false)}
        />
      ) : null}
      {secret === 'missing' ? (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
          <TriangleAlert size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            The key is missing from this Mac's keychain, so every request with it fails. Disconnect
            and connect again to paste a new one.
          </span>
        </p>
      ) : null}
      {error != null ? <p className="text-2xs leading-relaxed text-danger">{error}</p> : null}
    </div>
  );
};
