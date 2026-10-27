import { describe, expect, it } from 'vitest';
import { POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, type PopoverWidth } from './popoverWidth';

const NAMES: ReadonlyArray<PopoverWidth> = ['compact', 'standard', 'wide', 'studio'];

describe('popover widths', () => {
  it('names four widths once: 240, 320, 384 and 500', () => {
    expect(NAMES.map((name) => POPOVER_WIDTH_PX[name])).toEqual([240, 320, 384, 500]);
  });

  it('keeps the class and the pixels of each name on the same width', () => {
    NAMES.forEach((name) => {
      const step = Number(POPOVER_WIDTH_CLASS[name].replace('w-', ''));
      expect(step * 4).toBe(POPOVER_WIDTH_PX[name]);
    });
  });
});
