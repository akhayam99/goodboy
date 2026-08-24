import { useState } from 'react';
import { Chip, formatError, IconButton, InlineConfirm } from '@goodboy/ui';
import { Unplug } from 'lucide-react';
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
  readonly disconnectDescription: string;
  readonly onDisconnect: () => Promise<void>;
};

export const IntegrationConnectedRow = ({
  provider,
  primary,
  secondary,
  badge,
  disconnectDescription,
  onDisconnect,
}: Props) => {
  const label = integrationLabel({ provider });
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
      {error != null ? <p className="text-2xs leading-relaxed text-danger">{error}</p> : null}
    </div>
  );
};
