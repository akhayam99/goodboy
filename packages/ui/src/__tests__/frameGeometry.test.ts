import { describe, expect, it } from 'vitest';
import {
  FRAME_BAND_PX,
  FRAME_PAGES,
  FRAME_PAGE_HEADER_INSET_PX,
  FRAME_TITLE_CENTRE_PX,
  FRAME_TITLE_ROW_PX,
  FRAME_TYPES,
  PAGE_FRAME,
  PAGE_MEASURE,
  frameGeometryOf,
  frameTierOf,
  type FramePage,
  type FrameType,
} from '../frameGeometry';
import type { PageColumnWidth } from '../components/PageColumn';

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

  it('opens every session page, sidebar door page and closable overlay on its 44px header row', () => {
    expect(FRAME_PAGE_HEADER_INSET_PX + FRAME_TITLE_ROW_PX).toBe(44);
    for (const page of [
      'board',
      'settings',
      'overview',
      'orchestrated',
      'auto',
      'artifacts',
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
      'impact',
      'whatsNew',
      'release',
    ] as const) {
      expect(frameGeometryOf({ page }).bandHeight, page).toBe(FRAME_PAGE_HEADER_INSET_PX);
    }
  });

  it('puts no page under a 40px band, since every Close sits on the title row', () => {
    expect(
      FRAME_PAGES.filter((page) => frameGeometryOf({ page }).bandHeight === FRAME_BAND_PX),
    ).toEqual([]);
    expect(FRAME_PAGES.every((page) => frameGeometryOf({ page }).titleRowHeight === 32)).toBe(true);
  });

  it('puts the drawer header row on the page title line', () => {
    for (const page of FRAME_PAGES) {
      expect(frameGeometryOf({ page }).drawerRowHeight, page).toBe(FRAME_TITLE_ROW_PX);
    }
    expect(FRAME_PAGE_HEADER_INSET_PX + FRAME_TITLE_ROW_PX / 2).toBe(28);
  });
});

describe('PAGE_MEASURE', () => {
  it('reads the 720 measure only on the chat room, and the full width only on the work surfaces', () => {
    const measureOf = (width: PageColumnWidth) =>
      FRAME_PAGES.filter((page) => PAGE_MEASURE[page] === width);

    expect(measureOf('measure')).toEqual(['chat']);
    expect(measureOf('full')).toEqual(['board', 'terminal']);
    expect(PAGE_MEASURE.overview).toBe(PAGE_MEASURE.runs);
    expect(Object.keys(PAGE_MEASURE).sort()).toEqual([...FRAME_PAGES].sort());
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
