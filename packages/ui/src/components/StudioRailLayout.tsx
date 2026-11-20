import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from '../icons';
import { assignRef } from '../assignRef';
import { cn } from '../cn';
import { studioRailPaneStore } from '../studioRailPaneStore';
import { useEscapeLayer } from '../useEscapeLayer';
import { INNER_COLUMN_SHORTCUT } from '../innerColumnStore';
import { useInnerColumn } from '../useInnerColumn';
import { PANE_RHYTHM } from '../paneRhythm';
import { SHEET_CLASSES, type ResizeActivity } from '../sheet';
import { readStoredWidth, useResizableWidth } from '../useResizableWidth';
import { IconButton } from './IconButton';
import { SplitHandle } from './SplitHandle';

export const STUDIO_RAIL_WIDTHS = {
  narrow: 256,
  standard: 288,
  wide: 340,
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
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => studioRailPaneStore.subscribe({ listener }),
    [],
  );
  const isNarrow = useSyncExternalStore(subscribe, () => studioRailPaneStore.isNarrow({ surface }));
  const rootRef = useCallback(
    (node: HTMLDivElement | null) => {
      assignRef({ ref: resizable.targetRef, value: node });
      setRoot(node);
    },
    [resizable.targetRef],
  );
  useEffect(() => {
    if (root === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        studioRailPaneStore.setWidth({ surface, width: entry.contentRect.width });
      }
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      studioRailPaneStore.setWidth({ surface, width: null });
    };
  }, [root, surface]);
  const isPage = placement === 'page';
  const hasHeaderRow = railHeader !== undefined || onCollapsedChange !== undefined;
  const railName = railLabel.toLowerCase();
  const hideLabel = `Hide ${railName}`;
  const showLabel = `Show ${railName}`;
  const isRailShown = !isCollapsed && rail !== null;
  const isOverPage = isNarrow && isRailShown && detail !== null && onCollapsedChange !== undefined;
  useEscapeLayer(() => onCollapsedChange?.(true), isOverPage);
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
      ref={rootRef}
      data-studio-rail={placement}
      style={resizable.style}
      className={cn('relative flex h-full min-h-0 flex-1', isPage ? 'bg-background' : 'bg-chrome')}
    >
      {(isRailShown && !isOverPage) ||
      onCollapsedChange === undefined ||
      !canUnfold ||
      rail === null ? null : (
        <div data-studio-rail-unfold="" className="flex w-11 shrink-0 flex-col items-center">
          <div data-grid-row="1" className={cn('flex shrink-0 items-center', PANE_RHYTHM.firstRow)}>
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
          data-rail-over-page={isOverPage ? '' : undefined}
          style={{ width: `var(${RAIL_WIDTH_VAR})` }}
          className={cn(
            'flex min-h-0 shrink-0 flex-col',
            isOverPage
              ? cn(
                  'absolute inset-y-0 left-0 z-20 border-r border-border-soft shadow-xl',
                  isPage ? 'bg-background' : 'bg-chrome',
                )
              : 'relative',
          )}
        >
          {hasHeaderRow ? (
            <div
              data-grid-row="1"
              className={cn('flex shrink-0 items-center gap-2 px-2', PANE_RHYTHM.firstRow)}
            >
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
            <SplitHandle
              {...resizable.handleProps}
              ariaLabel={`Resize ${railLabel.toLowerCase()}`}
              onActivityChange={setActivity}
              shouldDrawEdge={isPage}
            />
          </div>
        </aside>
      )}
      {detail === null ? null : (
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
      )}
    </div>
  );
};
