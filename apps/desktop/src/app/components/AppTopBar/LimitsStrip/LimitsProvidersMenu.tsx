import type { LimitsChip as LimitsChipModel } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import {
  AnchoredPopover,
  StatusDot,
  FOCUS_RING,
  TOP_BAR_CONTROL,
  Tooltip,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useProvidersConnection } from '../../../hooks/useProvidersConnection';
import { ProvidersMenuPanel } from '../../ProvidersMenu/ProvidersMenuPanel';
import {
  PROVIDERS_PANEL_HEIGHT,
  PROVIDERS_PANEL_WIDTH,
} from '../../ProvidersMenu/providersPanelSize';
import { LimitsToolbar } from './LimitsToolbar';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chips: ReadonlyArray<LimitsChipModel>;
  readonly nowMs: number;
};

export const LimitsProvidersMenu = ({ workspaceId, chips, nowMs }: Props) => {
  const { hasNoProvider, isKnown } = useProvidersConnection();
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-[500px]',
    expectedWidth: PROVIDERS_PANEL_WIDTH,
    expectedHeight: PROVIDERS_PANEL_HEIGHT,
  });
  if (chips.length === 0 && !isKnown) {
    return null;
  }
  const label = hasNoProvider ? 'Connect a provider' : 'Providers';

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Providers"
      className="flex flex-col gap-1 py-2"
      anchorClassName="shrink-0"
      hasBackdrop
      trigger={
        chips.length > 0 ? (
          <LimitsToolbar
            chips={chips}
            nowMs={nowMs}
            pressedId={null}
            onOpen={() => dropdown.toggle()}
          />
        ) : (
          <Tooltip content={hasNoProvider ? 'Connect a provider to start' : 'Providers'}>
            <button
              type="button"
              onClick={dropdown.toggle}
              aria-label={label}
              aria-haspopup="dialog"
              aria-expanded={dropdown.open}
              data-limits-chip="providers"
              className={cn(
                TOP_BAR_CONTROL.height,
                TOP_BAR_CONTROL.radius,
                FOCUS_RING,
                'flex shrink-0 items-center gap-2 px-2 text-meta motion-safe:transition-colors',
                dropdown.open ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-hover',
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
              <span className="hidden @min-chrome-labels/topbar:inline">{label}</span>
            </button>
          </Tooltip>
        )
      }
    >
      <ProvidersMenuPanel workspaceId={workspaceId} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
