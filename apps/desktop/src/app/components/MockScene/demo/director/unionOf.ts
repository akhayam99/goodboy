import type { DemoRect } from './demoProtocol';

type Params = {
  readonly rects: ReadonlyArray<DemoRect>;
};

export const unionOf = ({ rects }: Params): DemoRect | null => {
  if (rects.length === 0) {
    return null;
  }
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};
