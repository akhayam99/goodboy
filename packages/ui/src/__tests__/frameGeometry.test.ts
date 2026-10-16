import { describe, expect, it } from 'vitest';
import {
  FRAME_BAND_PX,
  FRAME_DRAWER_INSET_PX,
  FRAME_DRAWER_ROW_PX,
  FRAME_PAGES,
  FRAME_PAGE_HEADER_INSET_PX,
  FRAME_TITLE_CENTRE_PX,
  FRAME_TITLE_ROW_PX,
  FRAME_TYPES,
  PAGE_FRAME,
  frameGeometryOf,
  frameTierOf,
  type FramePage,
  type FrameType,
} from '../frameGeometry';

const pagesOf = ({ type }: { readonly type: FrameType }): ReadonlyArray<FramePage> =>
  FRAME_PAGES.filter((page) => PAGE_FRAME[page] === type);

describe('frameGeometryOf', () => {
  it('puts every title centre at the space above it plus half the title row', () => {
    expect(FRAME_BAND_PX).toBe(40);
    expect(FRAME_TITLE_ROW_PX).toBe(32);
    expect(FRAME_TITLE_CENTRE_PX).toBe(56);
    for (const page of FRAME_PAGES) {
      const geometry = frameGeometryOf({ page });
      expect(geometry.titleCentreY, page).toBe(geometry.bandHeight + FRAME_TITLE_ROW_PX / 2);
    }
  });

  it('opens a session page, a sidebar door page and a closable overlay on its 44px header row', () => {
    expect(FRAME_PAGE_HEADER_INSET_PX + FRAME_TITLE_ROW_PX).toBe(44);
    for (const page of [
      'overview',
      'branch',
      'runs',
      'agents',
      'questions',
      'inbox',
      'chat',
      'workflows',
      'terminal',
      'monitoring',
      'notifications',
      'guide',
    ] as const) {
      expect(frameGeometryOf({ page }).bandHeight, page).toBe(FRAME_PAGE_HEADER_INSET_PX);
    }
  });

  it('keeps the 40px band where the band still holds Close or a trail', () => {
    for (const page of ['board', 'settings', 'impact', 'whatsNew'] as const) {
      expect(frameGeometryOf({ page }).bandHeight, page).toBe(FRAME_BAND_PX);
    }
    expect(FRAME_PAGES.every((page) => frameGeometryOf({ page }).titleRowHeight === 32)).toBe(true);
  });

  it('centres the drawer header row on the band centre line', () => {
    expect(FRAME_DRAWER_ROW_PX).toBe(28);
    expect(FRAME_DRAWER_INSET_PX + FRAME_DRAWER_ROW_PX / 2).toBe(FRAME_BAND_PX / 2);
  });
});

describe('PAGE_FRAME', () => {
  it('types every page with one of the four frames', () => {
    expect(Object.keys(PAGE_FRAME).sort()).toEqual([...FRAME_PAGES].sort());
    expect(FRAME_PAGES.every((page) => FRAME_TYPES.some((type) => type === PAGE_FRAME[page]))).toBe(
      true,
    );
  });

  it('refuses a page with no type at compile time', () => {
    const incomplete: Record<FramePage, FrameType> = {
      ...PAGE_FRAME,
      // @ts-expect-error a page key without a frame type is not assignable
      board: undefined,
    };

    expect(incomplete.board).toBeUndefined();
  });

  it('keeps the stage frame to the Board and the Terminal', () => {
    expect(pagesOf({ type: 'stage' })).toEqual(['board', 'terminal']);
  });

  it('keeps the split frame to the pages with a rail', () => {
    expect([...pagesOf({ type: 'split' })].sort()).toEqual(
      ['branch', 'chat', 'guide', 'inbox', 'notifications', 'whatsNew'].sort(),
    );
  });

  it('reads the title left from the type', () => {
    expect(frameGeometryOf({ page: 'overview' }).titleLeft).toBe('column');
    expect(frameGeometryOf({ page: 'plan' }).titleLeft).toBe('column');
    expect(frameGeometryOf({ page: 'board' }).titleLeft).toBe('stage');
    expect(frameGeometryOf({ page: 'chat' }).titleLeft).toBe('detail');
    expect(frameGeometryOf({ page: 'guide' }).titleLeft).toBe('detail');
  });

  it('puts a rail studio on the column tier of its detail and the stage on the full tier', () => {
    expect(frameTierOf({ type: 'split' })).toBe('column');
    expect(frameTierOf({ type: 'column' })).toBe('column');
    expect(frameTierOf({ type: 'reader' })).toBe('column');
    expect(frameTierOf({ type: 'stage' })).toBe('full');
  });
});
