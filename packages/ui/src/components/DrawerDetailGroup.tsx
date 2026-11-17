import type { ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { DrawerContentContext } from '../drawerContentContext';
import { DRAWER_GUTTER, type DrawerMode } from '../drawerGeometry';
import type { ResizableHandleProps } from '../useResizableWidth';
import type { DrawerPanel } from '../useDrawerPanel';
import { DrawerPanelCard } from './DrawerPanelCard';
import { SplitHandle } from './SplitHandle';

const DETAIL_CONTENT = 'w-[calc(var(--goodboy-detail-panel)-2px)]';

const SLIDE = 'motion-safe:transition-[width] duration-200 ease-enter';

type Props = {
  readonly groupRef: Ref<HTMLDivElement>;
  readonly panel: DrawerPanel;
  readonly node: ReactNode;
  readonly panelKey: string;
  readonly shownWidth: number;
  readonly width: number;
  readonly dragMax: number;
  readonly handleProps: ResizableHandleProps;
  readonly resizeLabel: string;
  readonly isOpen: boolean;
  readonly isParked: boolean;
  readonly isOverlay: boolean;
  readonly isFloating: boolean;
  readonly mode: DrawerMode;
  readonly columnWidth: number | null;
  readonly savedWidth: number;
};

export const DrawerDetailGroup = ({
  groupRef,
  panel,
  node,
  panelKey,
  shownWidth,
  width,
  dragMax,
  handleProps,
  resizeLabel,
  isOpen,
  isParked,
  isOverlay,
  isFloating,
  mode,
  columnWidth,
  savedWidth,
}: Props) => (
  <div
    ref={groupRef}
    data-detail-group=""
    style={{ width: shownWidth > 0 ? shownWidth + DRAWER_GUTTER : 0 }}
    className={cn('flex min-h-0 shrink-0 overflow-clip', !isFloating && SLIDE)}
  >
    <div className={cn('flex w-3 shrink-0 justify-center', isOverlay && 'pointer-events-auto')}>
      {isOpen && !isParked ? (
        <SplitHandle
          {...handleProps}
          max={dragMax}
          value={width}
          side="right"
          ariaLabel={resizeLabel}
        />
      ) : null}
    </div>
    <div
      data-container="detail"
      className={cn(
        'panel-on-page relative flex min-h-0 min-w-0 flex-1 overflow-clip rounded-frame border border-frame-edge bg-background',
        isFloating && 'pointer-events-auto shadow-xl',
      )}
    >
      {isOpen || panel.exit.isExiting ? (
        <DrawerContentContext.Provider value={{ columnWidth, savedWidth, mode }}>
          <DrawerPanelCard
            slot="detail"
            panel={panel}
            node={node}
            panelKey={panelKey}
            isOpen={isOpen}
            isParked={isParked}
            isOverlay={isOverlay}
            isFloating={isFloating}
            parkedWidth={width}
            pushWidthClass={DETAIL_CONTENT}
          />
        </DrawerContentContext.Provider>
      ) : null}
    </div>
  </div>
);
