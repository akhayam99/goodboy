import { useState, type ReactNode } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { cn } from '../cn';
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
  readonly rail: ReactNode;
  readonly detail: ReactNode;
  readonly railLabel: string;
  readonly railWidth: RailWidth;
  readonly surface: string;
  readonly placement?: StudioRailPlacement;
  readonly min?: number;
  readonly max?: number;
  readonly railHeader?: ReactNode;
  readonly isCollapsed?: boolean;
  readonly onCollapsedChange?: (isCollapsed: boolean) => void;
};

export const StudioRailLayout = ({
  rail,
  detail,
  railLabel,
  railWidth,
  surface,
  placement = 'chrome',
  min = STUDIO_RAIL_MIN,
  max = STUDIO_RAIL_MAX,
  railHeader,
  isCollapsed = false,
  onCollapsedChange,
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

  return (
    <div
      ref={resizable.targetRef}
      data-studio-rail={placement}
      style={resizable.style}
      className={cn('flex h-full min-h-0 flex-1', isPage ? 'bg-background' : 'bg-chrome')}
    >
      {isCollapsed ? null : (
        <aside
          aria-label={railLabel}
          style={{ width: `var(${RAIL_WIDTH_VAR})` }}
          className="relative flex min-h-0 shrink-0 flex-col"
        >
          {hasHeaderRow ? (
            <div className="flex shrink-0 items-center gap-2 px-2 pt-3">
              <div className="flex min-w-0 flex-1 items-center">{railHeader}</div>
              {onCollapsedChange === undefined ? null : (
                <IconButton
                  icon={PanelLeftClose}
                  label="Fold the rail"
                  onClick={() => onCollapsedChange(true)}
                />
              )}
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
        )}
      >
        {detail}
      </div>
    </div>
  );
};
