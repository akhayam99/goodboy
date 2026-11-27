import { useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { DockDragStore } from '../dockDragStore';
import type { DockRect } from '../dockDropZonesOf';
import { dockPillPlaceOf } from '../dockPillPlaceOf';
import { dockFoldLineOf, dockNameOf } from '../dockStatusOf';
import { cn } from '../cn';
import { DROP_CHIP_SURFACE } from '../dropChipSurface';
import { DockDropPill } from './DockDropPill';

type Props = {
  readonly store: DockDragStore;
};

const CHIP_OFFSET_X_PX = 18;

const CHIP_OFFSET_Y_PX = 34;

const CHIP_FLIP_ROOM_PX = 240;

const CHIP_HEIGHT_PX = 28;

const OUTLINE_INSET_PX = 5;

const CROWDED_PILLS = 8;

type InsetParams = {
  readonly rect: DockRect;
};

const insetOf = ({ rect }: InsetParams): DockRect => ({
  x: rect.x + OUTLINE_INSET_PX,
  y: rect.y + OUTLINE_INSET_PX,
  width: Math.max(0, rect.width - OUTLINE_INSET_PX * 2),
  height: Math.max(0, rect.height - OUTLINE_INSET_PX * 2),
});

export const DockDropZones = ({ store }: Props) => {
  const view = useSyncExternalStore((listener) => store.subscribe({ listener }), store.get);
  const lastOutline = useRef<DockRect | null>(null);
  if (view === null) {
    lastOutline.current = null;
    return null;
  }
  const hovered = view.zones.find((zone) => zone.id === view.hoverId) ?? null;
  const ghost = hovered === null ? null : (view.ghost?.rect ?? null);
  const outline = ghost === null ? null : insetOf({ rect: ghost });
  if (outline !== null) {
    lastOutline.current = outline;
  }
  const shownOutline = outline ?? lastOutline.current;
  const fold =
    outline === null ? null : dockFoldLineOf({ names: view.names, folds: view.ghost?.folds ?? [] });
  const isRaised =
    view.y + CHIP_OFFSET_Y_PX + CHIP_HEIGHT_PX > document.documentElement.clientHeight;
  const isFlipped = view.x > document.documentElement.clientWidth - CHIP_FLIP_ROOM_PX;
  return createPortal(
    <div
      data-dock-drop=""
      className={cn(
        'pointer-events-none fixed inset-0 z-drag',
        view.zones.length > CROWDED_PILLS && '[--drop-chip-blur:8px]',
      )}
    >
      {shownOutline === null ? null : (
        <div
          data-dock-ghost=""
          style={{
            left: shownOutline.x,
            top: shownOutline.y,
            width: shownOutline.width,
            height: shownOutline.height,
          }}
          className={cn('drop-ghost absolute', outline === null ? 'opacity-0' : 'opacity-100')}
        />
      )}
      {view.zones.map((zone) => {
        const pane =
          zone.paneKey === null ? null : dockNameOf({ names: view.names, key: zone.paneKey });
        return (
          <DockDropPill
            key={zone.id}
            zone={zone}
            anchor={dockPillPlaceOf({ zone, outline })}
            isHovered={view.hoverId === zone.id}
            isDimmed={view.hoverId !== null && view.hoverId !== zone.id}
            detail={
              zone.placement === 'merge' && pane !== null
                ? view.isSwap
                  ? `Swap with ${pane}`
                  : `as a tab in ${pane}`
                : null
            }
          />
        );
      })}
      {fold === null || outline === null ? null : (
        <div
          data-dock-fold=""
          style={{ left: outline.x + outline.width / 2, top: outline.y + outline.height - 12 }}
          className={cn(
            DROP_CHIP_SURFACE,
            'absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-3 py-1 text-meta text-foreground',
          )}
        >
          {fold}
        </div>
      )}
      {hovered === null ? (
        <div
          data-dock-chip=""
          style={{
            left: isFlipped ? view.x - CHIP_OFFSET_X_PX : view.x + CHIP_OFFSET_X_PX,
            top: isRaised ? view.y - CHIP_OFFSET_Y_PX : view.y + CHIP_OFFSET_Y_PX,
          }}
          className={cn(
            DROP_CHIP_SURFACE,
            'absolute max-w-60 truncate rounded-lg px-3 py-1 text-meta text-foreground',
            isFlipped && '-translate-x-full',
            isRaised && '-translate-y-full',
          )}
        >
          {view.title}
        </div>
      ) : null}
      <p data-dock-status="" role="status" aria-live="polite" className="sr-only">
        {view.status}
      </p>
    </div>,
    document.body,
  );
};
