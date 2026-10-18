// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BOOT_MARK_PX } from '../../../../app/components/BootSplash/bootMark';
import { SPLASH_MARK_ABOVE_MIDDLE_PX, SPLASH_MARK_PX, splashShift } from './splashShift';

describe('splashShift', () => {
  it('reads the same mark size as the boot splash', () => {
    expect(SPLASH_MARK_PX).toBe(BOOT_MARK_PX);
    expect(SPLASH_MARK_ABOVE_MIDDLE_PX).toBe(53);
  });

  it('moves the tile down onto the pixel where the splash dog sits', () => {
    expect(splashShift({ markCenter: 300, blockBottom: 600, viewportHeight: 900 })).toBe(97);
  });

  it('never moves the cover up, and keeps its bottom on screen in a short window', () => {
    expect(splashShift({ markCenter: 500, blockBottom: 700, viewportHeight: 900 })).toBe(0);
    expect(splashShift({ markCenter: 200, blockBottom: 540, viewportHeight: 600 })).toBe(20);
  });
});
