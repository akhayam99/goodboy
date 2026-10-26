import type { DemoRect } from '../director/demoProtocol';

type Size = {
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly anchor: DemoRect;
  readonly focus: DemoRect | null;
  readonly bounds: Size;
  readonly pad: number;
};

export const holeOf = ({ anchor, focus, bounds, pad }: Params): DemoRect => {
  const left = Math.min(anchor.x, focus?.x ?? anchor.x) - pad;
  const top = Math.min(anchor.y, focus?.y ?? anchor.y) - pad;
  const right = Math.max(anchor.x + anchor.width, focus === null ? 0 : focus.x + focus.width) + pad;
  const bottom =
    Math.max(anchor.y + anchor.height, focus === null ? 0 : focus.y + focus.height) + pad;
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  return {
    x,
    y,
    width: Math.max(0, Math.min(bounds.width, right) - x),
    height: Math.max(0, Math.min(bounds.height, bottom) - y),
  };
};
