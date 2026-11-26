import type { ReactNode } from 'react';
import { cn } from '../cn';
import type { DrawerPanel } from '../useDrawerPanel';
import { DrawerPanelCard } from './DrawerPanelCard';

const PUSH_CONTENT = 'w-[calc(var(--goodboy-drawer-panel)-1px)]';

const GRID_CONTENT = 'w-[var(--goodboy-drawer-panel)]';

type Props = {
  readonly panel: DrawerPanel;
  readonly node: ReactNode;
  readonly panelKey: string;
  readonly isOpen: boolean;
  readonly isParked: boolean;
  readonly isOverlay: boolean;
  readonly isFloating: boolean;
  readonly isIdle: boolean;
  readonly isOverDetail?: boolean;
  readonly parkedWidth: number;
  readonly setEdgeHost: (node: HTMLDivElement | null) => void;
  readonly isGrid?: boolean;
  readonly isFocused?: boolean;
};

export const DrawerDockBox = ({
  panel,
  node,
  panelKey,
  isOpen,
  isParked,
  isOverlay,
  isFloating,
  isIdle,
  isOverDetail = false,
  parkedWidth,
  setEdgeHost,
  isGrid = false,
  isFocused = false,
}: Props) => {
  const isSlidingIn = isOverlay && isOpen && !isParked && !panel.exit.isResumed;
  return (
    <div
      data-container="drawer"
      data-panel-focused={isFocused ? '' : undefined}
      data-panel-over-page={isFloating ? '' : undefined}
      data-dock-over-detail={isOverDetail ? '' : undefined}
      style={isOverDetail ? { width: parkedWidth } : undefined}
      className={cn(
        isOverDetail && 'absolute inset-y-3 right-0 z-20 shadow-xl',
        'panel-on-rail relative flex min-h-0 min-w-0 flex-1 overflow-clip rounded-l-frame border-y border-l',
        isFocused ? 'border-focus-ring' : 'border-frame-edge',
        isGrid ? 'border-0 bg-transparent' : 'bg-drawer',
        isFloating && 'pointer-events-auto',
        isFloating && !isGrid && 'shadow-xl',
        isIdle && 'border-0',
        isSlidingIn && 'motion-safe:animate-drawer-dock-in',
        panel.isOverlayExit && 'motion-safe:animate-drawer-dock-out',
      )}
    >
      {isOpen || panel.exit.isExiting ? (
        <DrawerPanelCard
          slot="drawer"
          panel={panel}
          node={node}
          panelKey={panelKey}
          isOpen={isOpen}
          isParked={isParked}
          isOverlay={isOverlay}
          isFloating={isFloating}
          parkedWidth={parkedWidth}
          pushWidthClass={isGrid ? GRID_CONTENT : PUSH_CONTENT}
        />
      ) : null}
      <div
        ref={setEdgeHost}
        data-drawer-edge=""
        className="relative z-10 flex shrink-0 bg-drawer empty:hidden"
      />
    </div>
  );
};
