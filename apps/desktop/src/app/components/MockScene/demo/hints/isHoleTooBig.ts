import type { DemoRect } from '../director/demoProtocol';
import { holeOf } from './holeOf';

type Params = {
  readonly anchor: DemoRect;
  readonly focus: DemoRect | null;
  readonly bounds: { readonly width: number; readonly height: number };
};

const MAX_SHARE = 0.6;
const PAD = 8;

export const isHoleTooBig = ({ anchor, focus, bounds }: Params): boolean => {
  const hole = holeOf({ anchor, focus, bounds, pad: PAD });
  return hole.width * hole.height > bounds.width * bounds.height * MAX_SHARE;
};
