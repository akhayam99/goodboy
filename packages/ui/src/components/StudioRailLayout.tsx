import { useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { SHEET_CLASSES, type ResizeActivity } from '../sheet';
import { readStoredWidth, useResizableWidth } from '../useResizableWidth';
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

export const readStudioRailWidth = ({
  surface,
  railWidth,
}: {
  readonly surface: string;
  readonly railWidth: RailWidth;
}): number =>
  readStoredWidth({
    storageKey: studioRailStorageKey({ surface }),
    fallback: STUDIO_RAIL_WIDTHS[railWidth],
    min: STUDIO_RAIL_MIN,
    max: STUDIO_RAIL_MAX,
  });

type Props = {
  readonly rail: ReactNode;
  readonly detail: ReactNode;
  readonly railLabel: string;
  readonly railWidth: RailWidth;
  readonly surface: string;
  readonly placement?: StudioRailPlacement;
};

export const StudioRailLayout = ({
  rail,
  detail,
  railLabel,
  railWidth,
  surface,
  placement = 'chrome',
}: Props) => {
  const resizable = useResizableWidth<HTMLDivElement>({
    storageKey: studioRailStorageKey({ surface }),
    defaultWidth: STUDIO_RAIL_WIDTHS[railWidth],
    min: STUDIO_RAIL_MIN,
    max: STUDIO_RAIL_MAX,
    cssVar: RAIL_WIDTH_VAR,
  });
  const [activity, setActivity] = useState<ResizeActivity>('idle');
  const isPage = placement === 'page';

  return (
    <div
      ref={resizable.targetRef}
      data-studio-rail={placement}
      style={resizable.style}
      className={cn('flex h-full min-h-0 flex-1', isPage ? 'bg-background' : 'bg-chrome')}
    >
      <aside
        aria-label={railLabel}
        style={{ width: `var(${RAIL_WIDTH_VAR})` }}
        className="relative flex min-h-0 shrink-0 flex-col"
      >
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
