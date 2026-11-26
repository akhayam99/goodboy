import type { DockDropZone } from './dockDropZonesOf';

export type DockStepDirection = 'next' | 'previous';

type Params = {
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly hoverId: string | null;
  readonly direction: DockStepDirection;
};

export const dockZoneStepOf = ({ zones, hoverId, direction }: Params): string | null => {
  if (zones.length === 0) {
    return null;
  }
  const at = zones.findIndex((zone) => zone.id === hoverId);
  if (at < 0) {
    return (direction === 'next' ? zones[0] : zones[zones.length - 1])?.id ?? null;
  }
  const step = direction === 'next' ? 1 : -1;
  return zones[(at + step + zones.length) % zones.length]?.id ?? null;
};
