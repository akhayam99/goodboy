import { describe, expect, it } from 'vitest';
import { APP_SIZE } from './appSize';
import { stageFitOf } from './stageFitOf';

describe('stageFitOf', () => {
  it('draws the app at its real size and lets it grow into a bigger stage', () => {
    expect(stageFitOf({ box: { width: 1600, height: 1000 } })).toEqual({
      scale: 1,
      width: 1600,
      height: 1000,
    });
  });

  it('scales the reference app down to the stage and fills the whole box', () => {
    const fit = stageFitOf({ box: { width: 1100, height: 700 } });
    expect(fit.scale).toBeCloseTo(Math.min(1100 / APP_SIZE.width, 700 / APP_SIZE.height));
    expect(fit.width * fit.scale).toBeCloseTo(1100);
    expect(fit.height * fit.scale).toBeCloseTo(700);
    expect(fit.width).toBeGreaterThanOrEqual(APP_SIZE.width - 0.001);
    expect(fit.height).toBeGreaterThanOrEqual(APP_SIZE.height - 0.001);
  });

  it('never scales above one', () => {
    expect(stageFitOf({ box: { width: 4000, height: 3000 } }).scale).toBe(1);
  });

  it('has no fit while the stage has no room', () => {
    expect(stageFitOf({ box: { width: 0, height: 0 } })).toEqual({
      scale: 0,
      width: 0,
      height: 0,
    });
  });
});
