import type { MenuPoint } from './menuTypes';

const EDGE = 8;

export const placeContextMenu = ({
  point,
  width,
  height,
  viewport,
}: {
  readonly point: MenuPoint;
  readonly width: number;
  readonly height: number;
  readonly viewport: { readonly width: number; readonly height: number };
}): MenuPoint => {
  const x = point.x + width > viewport.width - EDGE ? Math.max(EDGE, point.x - width) : point.x;
  const y = point.y + height > viewport.height - EDGE ? Math.max(EDGE, point.y - height) : point.y;
  return { x, y };
};
