import type { WorkspaceId } from '@goodboy/types';
import { AnchoredPopover, StatusDot, Tooltip, cn, tintClasses, useDropdown } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { FOOTER_LABEL, FOOTER_LABELED_PAD } from '../AppFooter/FooterButton';
import { useProvidersConnection } from '../../hooks/useProvidersConnection';
import { PROVIDERS_PANEL_HEIGHT, PROVIDERS_PANEL_WIDTH } from './providersPanelSize';
import { ProvidersMenuPanel } from './ProvidersMenuPanel';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const ProvidersMenu = ({ workspaceId }: Props) => {
  const { hasNoProvider } = useProvidersConnection();
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-[500px]',
    expectedWidth: PROVIDERS_PANEL_WIDTH,
    expectedHeight: PROVIDERS_PANEL_HEIGHT,
  });
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
              'flex items-center rounded-md py-1 text-meta transition-colors',
              FOOTER_LABELED_PAD,
              dropdown.open
                ? 'bg-hover text-foreground'
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
      <ProvidersMenuPanel workspaceId={workspaceId} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
