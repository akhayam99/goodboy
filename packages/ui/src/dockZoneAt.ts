import type { DockDropZone } from './dockDropZonesOf';

type Params = {
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly x: number;
  readonly y: number;
};

export const dockZoneAt = ({ zones, x, y }: Params): DockDropZone | null =>
  zones
    .filter(
      ({ rect }) =>
        x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
    )
    .reduce<DockDropZone | null>(
      (best, zone) => (best === null || zone.layer > best.layer ? zone : best),
      null,
    );
