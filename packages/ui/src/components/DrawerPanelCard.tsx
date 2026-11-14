import type { ReactNode } from 'react';
import { cn } from '../cn';
import { DrawerParkedContext } from '../drawerParkedContext';
import type { DrawerPanel } from '../useDrawerPanel';

export type DrawerPanelSlot = 'drawer' | 'detail';

type Props = {
  readonly slot: DrawerPanelSlot;
  readonly panel: DrawerPanel;
  readonly node: ReactNode;
  readonly panelKey: string;
  readonly isOpen: boolean;
  readonly isParked: boolean;
  readonly isOverlay: boolean;
  readonly isFloating: boolean;
  readonly parkedWidth: number;
  readonly pushWidthClass: string;
};

export const DrawerPanelCard = ({
  slot,
  panel,
  node,
  panelKey,
  isOpen,
  isParked,
  isOverlay,
  isFloating,
  parkedWidth,
  pushWidthClass,
}: Props) => {
  const { exit, isOverlayExit, isPushExit } = panel;
  const isExiting = exit.isExiting;
  return (
    <div
      ref={panel.cardRef}
      data-drawer-card={slot === 'drawer' ? '' : undefined}
      data-detail-card={slot === 'detail' ? '' : undefined}
      tabIndex={isOverlay ? -1 : undefined}
      inert={!isOpen || isParked || isExiting}
      style={isParked ? { width: parkedWidth } : undefined}
      className={cn(
        'flex min-h-0 min-w-0 flex-col items-end overflow-clip',
        isParked ? 'invisible absolute inset-y-0 left-0' : 'flex-1',
        isOverlay && 'focus-visible:outline-none',
        isOverlay && !exit.isResumed && 'motion-safe:animate-drawer-overlay-in',
        isExiting && 'pointer-events-none',
        isOverlayExit &&
          'motion-safe:animate-drawer-overlay-out motion-reduce:animate-drawer-fade-out',
      )}
    >
      <div
        data-drawer-content={slot === 'drawer' ? '' : undefined}
        data-detail-content={slot === 'detail' ? '' : undefined}
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          !isFloating && pushWidthClass,
          !isFloating && !isExiting && !exit.isResumed && 'motion-safe:animate-drawer-content-in',
          isPushExit && 'motion-safe:animate-drawer-content-out',
        )}
      >
        <div
          key={isExiting ? `${panelKey}:exit` : panelKey}
          ref={isExiting ? panel.mountSnapshot : panel.contentRef}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            !isExiting && 'motion-safe:animate-drawer-swap',
          )}
        >
          <DrawerParkedContext.Provider value={isParked}>
            {isOpen ? node : null}
          </DrawerParkedContext.Provider>
        </div>
      </div>
    </div>
  );
};
