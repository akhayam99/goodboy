import type { BrowserBounds } from './types';

type Params = {
  readonly a: BrowserBounds;
  readonly b: BrowserBounds;
};

export const sameBounds = ({ a, b }: Params): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
