import { ArrowUpRight } from 'lucide-react';
import { isApiProvider } from '@goodboy/core';
import type { ProviderConnectionState, ProviderId, WorkspaceId } from '@goodboy/types';
import {
  AnchoredPopover,
  EmptyLine,
  Eyebrow,
  StatusDot,
  Tooltip,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ProviderPolicyList } from '../../../../features/providers/components/ProviderPolicyList';
import { PROVIDER_ORDER } from '../../../../features/providers/components/ProviderStudio/providerOrder';
import { openProviderConnect } from '../../../../features/providers/openProviderConnect';
import { openProviderUsage } from '../../../../features/providers/openProviderUsage';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import { FOOTER_LABEL, FOOTER_LABELED_PAD } from '../FooterButton';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 520;

type ConnectionParams = {
  readonly id: ProviderId;
};

export const ProvidersMenu = ({ workspaceId }: Props) => {
  const providers = useAppStore((state) => state.providers);
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-[500px]',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_HEIGHT,
  });
  const connectionOf = ({ id }: ConnectionParams): ProviderConnectionState =>
    providers.find((provider) => provider.id === id)?.connection ?? 'unknown';
  const connected = PROVIDER_ORDER.filter((id) => connectionOf({ id }) === 'connected');
  const isKnown =
    providers.length > 0 && providers.every((provider) => provider.connection !== 'unknown');
  const hasNoProvider = isKnown && connected.length === 0;
  const missing = PROVIDER_ORDER.filter(
    (id) => connectionOf({ id }) !== 'connected' && !isApiProvider({ id }),
  );
  const title = hasNoProvider
    ? 'Connect a provider to start'
    : 'Providers, limits and the order this workspace uses';

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Providers"
      className="flex flex-col gap-1 py-2"
      anchorClassName="shrink-0"
      hasBackdrop
      trigger={
        <Tooltip content={title}>
          <button
            type="button"
            onClick={dropdown.toggle}
            aria-label={hasNoProvider ? 'Providers, none connected' : 'Providers'}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            className={cn(
              'flex items-center rounded-md py-1 text-secondary transition-colors',
              FOOTER_LABELED_PAD,
              dropdown.open
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground',
              hasNoProvider && tintClasses('warning').text,
            )}
          >
            <span className="relative flex items-center">
              <CONCEPT_ICONS.providers size={ICON_SIZE.control} aria-hidden />
              {hasNoProvider ? (
                <StatusDot
                  tone="warning"
                  size="sm"
                  pulsing
                  className="absolute -right-0.5 -top-0.5"
                />
              ) : null}
            </span>
            <span className={FOOTER_LABEL}>Providers</span>
          </button>
        </Tooltip>
      }
    >
      {connected.length > 0 ? (
        <>
          <div className="flex flex-col px-2">
            <Eyebrow label="This workspace" />
          </div>
          <div className="px-1">
            <ProviderPolicyList workspaceId={workspaceId} />
          </div>
        </>
      ) : (
        <EmptyLine className="px-2">No provider is connected yet.</EmptyLine>
      )}
      <ul aria-label="Provider actions" className="flex flex-col px-1 pt-1">
        {missing.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => {
                dropdown.close();
                openProviderConnect({ providerId: id, connection: connectionOf({ id }) });
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-label text-foreground hover:bg-hover"
            >
              <ProviderGlyph id={id} size={ICON_SIZE.control} />
              <span className="flex-1 text-left">Connect {PROVIDER_LABEL[id]}</span>
              <span className="text-secondary text-faint-foreground">Not connected</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              dropdown.close();
              openProviderUsage({ providerId: null });
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-label text-foreground hover:bg-hover"
          >
            <CONCEPT_ICONS.settings
              size={ICON_SIZE.row}
              aria-hidden
              className={tintClasses(CONCEPT_TONE.settings).icon}
            />
            <span className="flex-1 text-left">Open Providers &amp; models</span>
            <ArrowUpRight size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
          </button>
        </li>
      </ul>
    </AnchoredPopover>
  );
};
