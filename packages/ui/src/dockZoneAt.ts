import type { DockDropZone } from './dockDropZonesOf';

type Params = {
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly x: number;
  readonly y: number;
};

export const dockZoneAt = ({ zones, x, y }: Params): DockDropZone | null =>
  zones.find(
    ({ rect }) =>
      x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
  ) ?? null;
