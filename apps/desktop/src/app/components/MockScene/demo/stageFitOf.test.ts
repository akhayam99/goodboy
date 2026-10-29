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

  it.each([
    { name: '1000 by 628', box: { width: 968, height: 400 } },
    { name: '1280 by 720', box: { width: 996, height: 560 } },
    { name: '1440 by 900', box: { width: 1156, height: 740 } },
    { name: '1920 by 1080', box: { width: 1636, height: 920 } },
  ])(
    'fits the width and the height of the stage at $name without cropping or scrolling',
    ({ box }) => {
      const fit = stageFitOf({ box });
      expect(fit.scale).toBeLessThanOrEqual(1);
      expect(fit.width * fit.scale).toBeCloseTo(box.width);
      expect(fit.height * fit.scale).toBeCloseTo(box.height);
      expect(fit.height).toBeGreaterThanOrEqual(APP_SIZE.height - 0.001);
      expect(fit.width).toBeGreaterThanOrEqual(APP_SIZE.width - 0.001);
    },
  );

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
