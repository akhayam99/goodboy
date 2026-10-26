import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGE_SIZE, stageFitOf } from './stageFitOf';

describe('stageFitOf', () => {
  it('gives the app the whole stage at its real size when the stage is big enough', () => {
    expect(stageFitOf({ box: { width: 1348, height: 860 }, size: DEFAULT_STAGE_SIZE })).toEqual({
      scale: 1,
      width: 1348,
      height: 860,
    });
  });

  it('shrinks the scale just enough to keep the app at its minimum viewport', () => {
    const fit = stageFitOf({ box: { width: 1000, height: 600 }, size: DEFAULT_STAGE_SIZE });
    expect(fit.scale).toBeCloseTo(600 / 700);
    expect(fit.width * fit.scale).toBeCloseTo(1000);
    expect(fit.height * fit.scale).toBeCloseTo(600);
    expect(fit.width).toBeGreaterThanOrEqual(DEFAULT_STAGE_SIZE.minWidth);
    expect(fit.height).toBeGreaterThanOrEqual(DEFAULT_STAGE_SIZE.minHeight);
  });

  it('draws a small window larger when its size allows a scale above one', () => {
    const fit = stageFitOf({
      box: { width: 1400, height: 860 },
      size: { minWidth: 880, minHeight: 580, maxScale: 1.5 },
    });
    expect(fit.scale).toBeCloseTo(860 / 580);
    expect(fit.width * fit.scale).toBeCloseTo(1400);
  });

  it('has no fit while the stage has no room', () => {
    expect(stageFitOf({ box: { width: 0, height: 0 }, size: DEFAULT_STAGE_SIZE })).toEqual({
      scale: 0,
      width: 0,
      height: 0,
    });
  });
});
