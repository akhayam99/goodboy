import { StatusDot } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../features/integrations/components/IntegrationGlyph';
import type { FooterIntegrationEntry } from './categories';

type Props = {
  readonly member: FooterIntegrationEntry;
  readonly connected: boolean;
  readonly onSelect: () => void;
};

export const IntegrationAddRow = ({ member, connected, onSelect }: Props) => {
  const label = integrationLabel({ provider: member.provider });

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-label={connected ? `Open ${label}` : member.connectLabel}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/50"
      >
        <IntegrationGlyph provider={member.provider} size="xs" useBrandColor={connected} />
        <span className="flex-1 truncate text-xs text-foreground">{label}</span>
        <StatusDot tone={connected ? 'success' : 'neutral'} size="sm" />
        <span className="shrink-0 text-2xs text-muted-foreground">
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </button>
    </li>
  );
};
