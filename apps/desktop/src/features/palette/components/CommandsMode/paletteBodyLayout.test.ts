// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { PaletteEntry } from '../../types';
import { PALETTE_MIN_HEIGHT_PX, hasOwnPreviewOf, paletteBodyLayoutOf } from './paletteBodyLayout';

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

    expect(hasOwnPreviewOf({ entry: entry({ target }) })).toBe(true);
    expect(hasOwnPreviewOf({ entry: entry({ kind: 'artifact' }) })).toBe(true);
  });
});
