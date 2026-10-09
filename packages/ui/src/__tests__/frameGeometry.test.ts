import { describe, expect, it } from 'vitest';
import {
  FRAME_BAND_PX,
  FRAME_PAGES,
  FRAME_TITLE_CENTRE_PX,
  FRAME_TITLE_ROW_PX,
  frameGeometryOf,
} from '../frameGeometry';

describe('frameGeometryOf', () => {
  it('puts every title centre at the band plus half the title row', () => {
    expect(FRAME_BAND_PX).toBe(40);
    expect(FRAME_TITLE_ROW_PX).toBe(32);
    expect(FRAME_TITLE_CENTRE_PX).toBe(56);
    const centres = FRAME_PAGES.map((page) => frameGeometryOf({ page }).titleCentreY);

    expect(new Set(centres)).toEqual(new Set([56]));
  });

  it('gives every page the same band and row, and the column as the title left', () => {
    const geometry = FRAME_PAGES.filter((page) => page !== 'chat').map((page) =>
      frameGeometryOf({ page }),
    );

    expect(geometry.every((entry) => entry.bandHeight === 40)).toBe(true);
    expect(geometry.every((entry) => entry.titleRowHeight === 32)).toBe(true);
    expect(geometry.every((entry) => entry.titleLeft === 'column')).toBe(true);
  });

  it('aligns the chat thread title to the gutter beside its rail', () => {
    expect(frameGeometryOf({ page: 'chat' }).titleLeft).toBe('gutter');
  });
});
