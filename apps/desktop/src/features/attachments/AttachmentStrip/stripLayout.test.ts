import { describe, expect, it } from 'vitest';
import { splitStripImages } from './stripLayout';

describe('splitStripImages', () => {
  it('assumes the narrowest drawer, six thumbnails of 48 px, until the strip is measured', () => {
    expect(splitStripImages({ count: 6, width: null, canFold: true })).toMatchObject({
      shown: 6,
      hidden: 0,
    });
    expect(splitStripImages({ count: 7, width: 0, canFold: true })).toMatchObject({
      shown: 5,
      hidden: 2,
    });
  });

  it('counts the slots from the measured width and gives the last one to +N', () => {
    expect(splitStripImages({ count: 9, width: 352, canFold: true })).toMatchObject({
      shown: 5,
      hidden: 4,
    });
    expect(splitStripImages({ count: 9, width: 278, canFold: true })).toMatchObject({
      shown: 4,
      hidden: 5,
    });
    expect(splitStripImages({ count: 9, width: 600, canFold: true })).toMatchObject({
      shown: 9,
      hidden: 0,
    });
  });

  it('always fits the visible tiles and the +N tile in the measured width', () => {
    for (let width = 56; width <= 700; width += 7) {
      const { shown, hidden } = splitStripImages({ count: 12, width, canFold: true });
      const tiles = hidden > 0 ? shown + 1 : shown;
      expect(tiles * 48 + (tiles - 1) * 8).toBeLessThanOrEqual(width);
    }
  });

  it('keeps one slot for +N when the strip is narrower than two tiles', () => {
    expect(splitStripImages({ count: 4, width: 60, canFold: true })).toMatchObject({
      shown: 0,
      hidden: 4,
    });
  });

  it('shows nothing for no images', () => {
    expect(splitStripImages({ count: 0, width: 352, canFold: true })).toEqual({
      shown: 0,
      hidden: 0,
      desiredWidth: 0,
    });
  });

  it('never folds a strip that cannot fold', () => {
    expect(splitStripImages({ count: 12, width: 100, canFold: false })).toMatchObject({
      shown: 12,
      hidden: 0,
    });
  });

  it('asks for the width of at most six tiles so the bubble around it stays as before', () => {
    expect(splitStripImages({ count: 3, width: null, canFold: true }).desiredWidth).toBe(160);
    expect(splitStripImages({ count: 20, width: null, canFold: true }).desiredWidth).toBe(328);
  });
});
