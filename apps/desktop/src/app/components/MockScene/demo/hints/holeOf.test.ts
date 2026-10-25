import { describe, expect, it } from 'vitest';
import { holeOf } from './holeOf';

const BOUNDS = { width: 1000, height: 600 };
const ANCHOR = { x: 400, y: 300, width: 40, height: 20 };

describe('holeOf', () => {
  it('pads the control alone when there is no region', () => {
    expect(holeOf({ anchor: ANCHOR, focus: null, bounds: BOUNDS, pad: 8 })).toEqual({
      x: 392,
      y: 292,
      width: 56,
      height: 36,
    });
  });

  it('covers the control and the whole region with the padding on every side', () => {
    const focus = { x: 200, y: 100, width: 500, height: 400 };
    expect(holeOf({ anchor: ANCHOR, focus, bounds: BOUNDS, pad: 8 })).toEqual({
      x: 192,
      y: 92,
      width: 516,
      height: 416,
    });
  });

  it('reaches a control that sits outside its region', () => {
    const focus = { x: 100, y: 100, width: 200, height: 100 };
    const hole = holeOf({ anchor: ANCHOR, focus, bounds: BOUNDS, pad: 0 });
    expect(hole).toEqual({ x: 100, y: 100, width: 340, height: 220 });
  });

  it('stays inside the stage', () => {
    const focus = { x: -50, y: -20, width: 2000, height: 2000 };
    expect(holeOf({ anchor: ANCHOR, focus, bounds: BOUNDS, pad: 8 })).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 600,
    });
  });
});
