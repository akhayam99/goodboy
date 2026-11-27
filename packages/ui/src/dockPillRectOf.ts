import { PILL_HEIGHT_PX, type DockDropZone, type DockRect } from './dockDropZonesOf';

type Params = {
  readonly zone: DockDropZone;
};

const PILL_BASE_WIDTH_PX = 36;
const PILL_CHAR_WIDTH_PX = 7;

export const dockPillRectOf = ({ zone }: Params): DockRect => {
  const width = PILL_BASE_WIDTH_PX + zone.label.length * PILL_CHAR_WIDTH_PX;
  const { x, y, align } = zone.anchor;
  const left = align === 'start' ? x : align === 'end' ? x - width : x - width / 2;
  return { x: left, y: y - PILL_HEIGHT_PX / 2, width, height: PILL_HEIGHT_PX };
};
