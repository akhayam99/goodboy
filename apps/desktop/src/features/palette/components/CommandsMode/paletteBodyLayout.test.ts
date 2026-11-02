// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { PaletteEntry } from '../../types';
import {
  PALETTE_LIST_PAD_PX,
  PALETTE_MIN_HEIGHT_PX,
  PALETTE_ROW_PX,
  PALETTE_SECTION_PX,
  hasOwnPreviewOf,
  paletteBodyLayoutOf,
  paletteListMaxHeightOf,
} from './paletteBodyLayout';

const entry = (patch: Partial<PaletteEntry>): PaletteEntry => ({
  key: 'entry',
  label: 'Ask in chat',
  kind: 'goto',
  group: 'action',
  icon: Inbox,
  run: () => undefined,
  ...patch,
});

describe('paletteBodyLayoutOf', () => {
  it('holds one 320 minimum height with and without a preview pane', () => {
    expect(paletteBodyLayoutOf({ hasPreview: true }).minHeightPx).toBe(320);
    expect(paletteBodyLayoutOf({ hasPreview: false }).minHeightPx).toBe(320);
    expect(PALETTE_MIN_HEIGHT_PX).toBe(320);
  });

  it('hides the pane, never the height, when there is nothing to preview', () => {
    expect(paletteBodyLayoutOf({ hasPreview: false })).toEqual({
      minHeightPx: 320,
      previewShown: false,
    });
    expect(paletteBodyLayoutOf({ hasPreview: true })).toEqual({
      minHeightPx: 320,
      previewShown: true,
    });
  });
});

describe('paletteListMaxHeightOf', () => {
  it('keeps 320 when every row fits', () => {
    expect(paletteListMaxHeightOf({ sections: [{ hasTitle: true, rowCount: 3 }] })).toBe(320);
  });

  it('ends on a whole 28px row when the list overflows', () => {
    const sections = [
      { hasTitle: true, rowCount: 3 },
      { hasTitle: true, rowCount: 5 },
      { hasTitle: true, rowCount: 6 },
    ];
    const height = paletteListMaxHeightOf({ sections });

    expect(height).toBeLessThanOrEqual(320);
    expect((height - PALETTE_LIST_PAD_PX * 2 - 2 * PALETTE_SECTION_PX) % PALETTE_ROW_PX).toBe(0);
  });

  it('never ends on a section title without a row under it', () => {
    const height = paletteListMaxHeightOf({
      sections: [
        { hasTitle: true, rowCount: 9 },
        { hasTitle: true, rowCount: 4 },
      ],
    });

    expect(height).toBe(PALETTE_LIST_PAD_PX * 2 + PALETTE_SECTION_PX + 9 * PALETTE_ROW_PX);
  });
});

describe('hasOwnPreviewOf', () => {
  it('hides the pane for a plain command, even with a tag, a detail or a shortcut', () => {
    expect(hasOwnPreviewOf({ entry: entry({}) })).toBe(false);
    expect(hasOwnPreviewOf({ entry: entry({ tag: 'Session' }) })).toBe(false);
    expect(hasOwnPreviewOf({ entry: entry({ detail: 'payments-api' }) })).toBe(false);
    expect(hasOwnPreviewOf({ entry: entry({ shortcut: 'palette.open' }) })).toBe(false);
    expect(hasOwnPreviewOf({ entry: entry({ kind: 'verb' }) })).toBe(false);
  });

  it('shows the pane for an entry with facts of its own', () => {
    const target = { kind: 'session', sessionId: 's-1' as SessionId } as const;

    expect(hasOwnPreviewOf({ entry: entry({ kind: 'session', target }) })).toBe(true);
    expect(hasOwnPreviewOf({ entry: entry({ kind: 'verb', target }) })).toBe(false);
    expect(hasOwnPreviewOf({ entry: entry({ kind: 'artifact' }) })).toBe(true);
  });
});
