// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { splashShift } from './splashShift';

describe('splashShift', () => {
  it('aims at the boot splash mark, 53 px above the middle of the window', () => {
    expect(splashShift({ markCenter: 0, blockBottom: 0, viewportHeight: 1000 })).toBe(447);
  });

  it('moves the tile down onto the pixel where the splash dog sits', () => {
    expect(splashShift({ markCenter: 300, blockBottom: 600, viewportHeight: 900 })).toBe(97);
  });

  it('never moves the cover up, and keeps its bottom on screen in a short window', () => {
    expect(splashShift({ markCenter: 500, blockBottom: 700, viewportHeight: 900 })).toBe(0);
    expect(splashShift({ markCenter: 200, blockBottom: 540, viewportHeight: 600 })).toBe(20);
  });
});
