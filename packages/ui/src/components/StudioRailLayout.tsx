import { useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../cn';
import { INNER_COLUMN_SHORTCUT } from '../innerColumnStore';
import { useInnerColumn } from '../useInnerColumn';
import { SHEET_CLASSES, type ResizeActivity } from '../sheet';
import { readStoredWidth, useResizableWidth } from '../useResizableWidth';
import { IconButton } from './IconButton';
import { ResizeHandle } from './ResizeHandle';

export const STUDIO_RAIL_WIDTHS = {
  narrow: 256,
  standard: 288,
} as const satisfies Record<string, number>;

export const STUDIO_RAIL_MIN = 220;
export const STUDIO_RAIL_MAX = 420;

type RailWidth = keyof typeof STUDIO_RAIL_WIDTHS;

export type StudioRailPlacement = 'chrome' | 'page';

const RAIL_WIDTH_VAR = '--goodboy-studio-rail-width';

export const studioRailStorageKey = ({ surface }: { readonly surface: string }): string =>
  `goodboy:studio-rail-width:${surface}:v1`;

type ReadParams = {
  readonly surface: string;
  readonly railWidth: RailWidth;
  readonly min?: number;
  readonly max?: number;
};

export const readStudioRailWidth = ({
  surface,
  railWidth,
  min = STUDIO_RAIL_MIN,
  max = STUDIO_RAIL_MAX,
}: ReadParams): number =>
  readStoredWidth({
    storageKey: studioRailStorageKey({ surface }),
    fallback: STUDIO_RAIL_WIDTHS[railWidth],
    min,
    max,
  });

type Props = {
  readonly rail: ReactNode | null;
  readonly detail: ReactNode;
  readonly detailClassName?: string;
  readonly railLabel: string;
  readonly railWidth: RailWidth;
  readonly surface: string;
  readonly placement?: StudioRailPlacement;
  readonly min?: number;
  readonly max?: number;
  readonly railHeader?: ReactNode;
  readonly isCollapsed?: boolean;
  readonly onCollapsedChange?: (isCollapsed: boolean) => void;
  readonly canUnfold?: boolean;
  readonly foldedActions?: ReactNode;
};

export const StudioRailLayout = ({
  rail,
  detail,
  detailClassName,
  railLabel,
  railWidth,
  surface,
  placement = 'chrome',
  min = STUDIO_RAIL_MIN,
  max = STUDIO_RAIL_MAX,
  railHeader,
  isCollapsed = false,
  onCollapsedChange,
  canUnfold = true,
  foldedActions,
}: Props) => {
  const resizable = useResizableWidth<HTMLDivElement>({
    storageKey: studioRailStorageKey({ surface }),
    defaultWidth: STUDIO_RAIL_WIDTHS[railWidth],
    min,
    max,
    cssVar: RAIL_WIDTH_VAR,
  });
  const [activity, setActivity] = useState<ResizeActivity>('idle');
  const isPage = placement === 'page';
  const hasHeaderRow = railHeader !== undefined || onCollapsedChange !== undefined;
  const railName = railLabel.toLowerCase();
  const hideLabel = `Hide ${railName}`;
  const showLabel = `Show ${railName}`;
  const isRailShown = !isCollapsed && rail !== null;
  useInnerColumn({
    id: surface,
    label: isCollapsed ? showLabel : hideLabel,
    toggle: () => {
      if (isCollapsed && !canUnfold) {
        return;
      }
      onCollapsedChange?.(!isCollapsed);
    },
    isActive: onCollapsedChange !== undefined && rail !== null,
  });

  return (
    <div
      ref={resizable.targetRef}
      data-studio-rail={placement}
      style={resizable.style}
      className={cn('flex h-full min-h-0 flex-1', isPage ? 'bg-background' : 'bg-chrome')}
    >
      {isRailShown || onCollapsedChange === undefined || !canUnfold || rail === null ? null : (
        <div data-studio-rail-unfold="" className="flex w-11 shrink-0 flex-col items-center">
          <div data-grid-row="1" className="flex h-10 shrink-0 items-center">
            <IconButton
              icon={PanelLeftOpen}
              label={showLabel}
              shortcut={INNER_COLUMN_SHORTCUT}
              tooltipSide="right"
              aria-pressed={false}
              onClick={() => onCollapsedChange(false)}
            />
          </div>
          {foldedActions}
        </div>
      )}
      {!isRailShown ? null : (
        <aside
          aria-label={railLabel}
          style={{ width: `var(${RAIL_WIDTH_VAR})` }}
          className="relative flex min-h-0 shrink-0 flex-col"
        >
          {hasHeaderRow ? (
            <div data-grid-row="1" className="flex h-10 shrink-0 items-center gap-2 px-2">
              {onCollapsedChange === undefined ? null : (
                <IconButton
                  icon={PanelLeftClose}
                  label={hideLabel}
                  shortcut={INNER_COLUMN_SHORTCUT}
                  aria-pressed
                  onClick={() => onCollapsedChange(true)}
                />
              )}
              <div className="flex min-w-0 flex-1 items-center">{railHeader}</div>
            </div>
          ) : null}
          {rail}
          <div className="absolute inset-y-0 -right-1 z-10 flex">
            <ResizeHandle
              {...resizable.handleProps}
              ariaLabel={`Resize ${railLabel.toLowerCase()}`}
              onActivityChange={setActivity}
              drawsEdge={isPage}
            />
          </div>
        </aside>
      )}
      <div
        {...(!isPage && { 'data-sheet': 'wrapped', 'data-left-resize': activity })}
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-hidden bg-background',
          !isPage && SHEET_CLASSES.wrapped,
          detailClassName,
        )}
      >
        {detail}
      </div>
    </div>
  );
};
