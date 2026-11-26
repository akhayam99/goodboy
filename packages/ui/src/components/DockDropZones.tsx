import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { DockDragStore } from '../dockDragStore';
import { dockFoldLineOf, dockNameOf } from '../dockStatusOf';
import { GripVertical } from '../icons';
import { ICON_SIZE } from '../iconSize';
import { cn } from '../cn';
import { DockDropCard } from './DockDropCard';

type Props = {
  readonly store: DockDragStore;
};

const CHIP_OFFSET_PX = 14;

const FOLD_CHIP_GAP_PX = 8;

const FOLD_CHIP_ROOM_PX = 36;

export const DockDropZones = ({ store }: Props) => {
  const view = useSyncExternalStore((listener) => store.subscribe({ listener }), store.get);
  if (view === null) {
    return null;
  }
  const fold = dockFoldLineOf({ names: view.names, folds: view.ghost?.folds ?? [] });
  const ghost = view.ghost?.rect ?? null;
  const isOverTarget = view.hoverId !== null;
  const hovered = view.zones.find((zone) => zone.id === view.hoverId) ?? null;
  const chipAt =
    hovered === null
      ? { left: view.x - CHIP_OFFSET_PX, top: view.y - CHIP_OFFSET_PX }
      : {
          left: hovered.card.x + hovered.card.width,
          top: Math.min(
            hovered.card.y + hovered.card.height + FOLD_CHIP_GAP_PX,
            document.documentElement.clientHeight - FOLD_CHIP_ROOM_PX,
          ),
        };
  return createPortal(
    <div data-dock-drop="" className="pointer-events-none fixed inset-0 z-drag">
      <div data-dock-dim="" className="absolute inset-0 bg-scrim/25" />
      {ghost === null ? null : (
        <div
          data-dock-ghost=""
          style={{ left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height }}
          className="absolute rounded-frame bg-primary-subtle/90 ring-2 ring-inset ring-primary-edge"
        />
      )}
      {view.zones.map((zone) => {
        const pane =
          zone.paneKey === null ? null : dockNameOf({ names: view.names, key: zone.paneKey });
        return (
          <DockDropCard
            key={zone.id}
            zone={zone}
            isHovered={view.hoverId === zone.id}
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
      {fold === null || ghost === null ? null : (
        <div
          data-dock-fold=""
          style={{
            left: ghost.x + ghost.width / 2,
            top: Math.min(
              ghost.y + ghost.height + FOLD_CHIP_GAP_PX,
              document.documentElement.clientHeight - FOLD_CHIP_ROOM_PX,
            ),
          }}
          className="absolute -translate-x-1/2 rounded-md bg-elevated px-3 py-1 text-meta text-foreground shadow-lg"
        >
          {fold}
        </div>
      )}
      <div
        data-dock-chip=""
        style={chipAt}
        className={cn(
          'absolute -translate-x-full rounded-md bg-elevated px-3 py-1 text-body text-foreground shadow-lg',
          hovered === null && '-translate-y-full',
        )}
      >
        {isOverTarget ? <GripVertical size={ICON_SIZE.control} aria-hidden /> : view.title}
      </div>
      <p data-dock-status="" role="status" aria-live="polite" className="sr-only">
        {view.status}
      </p>
    </div>,
    document.body,
  );
};
