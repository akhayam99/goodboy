// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { PaletteEntry } from '../../types';
import {
  PALETTE_MIN_HEIGHT_PX,
  paletteBodyLayoutOf,
  previewFactCountOf,
} from './paletteBodyLayout';

const entry = (patch: Partial<PaletteEntry>): PaletteEntry => ({
  key: 'entry',
  label: 'Ask in Chat',
  kind: 'goto',
  group: 'action',
  icon: Inbox,
  run: () => undefined,
  ...patch,
});

describe('paletteBodyLayoutOf', () => {
  it('holds one 480 minimum height with and without a preview pane', () => {
    expect(paletteBodyLayoutOf({ hasPreview: true }).minHeightPx).toBe(480);
    expect(paletteBodyLayoutOf({ hasPreview: false }).minHeightPx).toBe(480);
    expect(PALETTE_MIN_HEIGHT_PX).toBe(480);
  });

  it('hides the pane, never the height, when there is nothing to preview', () => {
    expect(paletteBodyLayoutOf({ hasPreview: false })).toEqual({
      minHeightPx: 480,
      previewShown: false,
    });
    expect(paletteBodyLayoutOf({ hasPreview: true })).toEqual({
      minHeightPx: 480,
      previewShown: true,
    });
  });
});

describe('previewFactCountOf', () => {
  it('counts nothing for a bare entry, so the pane hides', () => {
    expect(previewFactCountOf({ entry: entry({}), subject: null })).toBe(0);
  });

  it('counts a target, a tag, a detail, a shortcut and a verb subject', () => {
    const target = { kind: 'session', sessionId: 's-1' as SessionId } as const;

    expect(previewFactCountOf({ entry: entry({ target }), subject: null })).toBe(1);
    expect(previewFactCountOf({ entry: entry({ tag: 'Session' }), subject: null })).toBe(1);
    expect(previewFactCountOf({ entry: entry({ detail: 'payments-api' }), subject: null })).toBe(1);
    expect(previewFactCountOf({ entry: entry({ shortcut: 'palette.open' }), subject: null })).toBe(
      1,
    );
    expect(previewFactCountOf({ entry: entry({ kind: 'verb' }), subject: 'Harborline' })).toBe(1);
    expect(previewFactCountOf({ entry: entry({ kind: 'verb' }), subject: null })).toBe(0);
  });
});
