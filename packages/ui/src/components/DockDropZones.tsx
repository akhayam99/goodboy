import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import type { DockDragStore } from '../dockDragStore';

type Props = {
  readonly store: DockDragStore;
};

const NO_ROOM = 'No room';

const GHOST_OFFSET_PX = 14;

export const DockDropZones = ({ store }: Props) => {
  const view = useSyncExternalStore((listener) => store.subscribe({ listener }), store.get);
  if (view === null) {
    return null;
  }
  return createPortal(
    <div data-dock-drop="" className="pointer-events-none fixed inset-0 z-drag">
      {view.zones.map((zone) => {
        const isHovered = view.hoverId === zone.id;
        return (
          <div
            key={zone.id}
            data-dock-zone={zone.id}
            data-dock-zone-valid={zone.isValid ? '' : undefined}
            data-dock-zone-hovered={isHovered ? '' : undefined}
            style={{
              left: zone.rect.x,
              top: zone.rect.y,
              width: zone.rect.width,
              height: zone.rect.height,
            }}
            className={cn(
              'absolute grid place-items-center overflow-hidden rounded-md text-meta ring-inset',
              zone.isVertical && '[writing-mode:vertical-rl]',
              zone.isValid ? 'text-primary ring-1 ring-primary' : 'text-danger ring-1 ring-danger',
              isHovered && 'ring-2',
              isHovered && zone.isValid && 'bg-primary-wash',
            )}
          >
            {zone.isValid ? zone.label : NO_ROOM}
          </div>
        );
      })}
      <div
        style={{ left: view.x + GHOST_OFFSET_PX, top: view.y + GHOST_OFFSET_PX }}
        className="absolute rounded-md bg-elevated px-3 py-1 text-body text-foreground shadow-lg"
      >
        {view.title}
      </div>
    </div>,
    document.body,
  );
};
