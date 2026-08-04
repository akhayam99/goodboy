import { describe, expect, it } from 'vitest';
import type { DiffHunk } from '@goodboy/types';
import { hunkLabel } from './hunkLabel';

const hunk = (patch: Partial<DiffHunk>): DiffHunk => ({
  header: '@@ -15,15 +16,15 @@',
  oldStart: 15,
  oldLines: 15,
  newStart: 16,
  newLines: 15,
  lines: [],
  ...patch,
});

describe('hunkLabel', () => {
  it('reads as a line range on the new side', () => {
    expect(hunkLabel({ hunk: hunk({}) })).toBe('Lines 16-30');
  });

  it('keeps the enclosing context the patch already names', () => {
    expect(
      hunkLabel({
        hunk: hunk({ header: '@@ -15,15 +16,15 @@ export const FlowProvider = memo(' }),
      }),
    ).toBe('Lines 16-30 · in export const FlowProvider = memo(');
  });

  it('truncates a context long enough to push the range off screen', () => {
    const label = hunkLabel({
      hunk: hunk({ header: `@@ -1,2 +1,2 @@ ${'x'.repeat(120)}` }),
    });
    expect(label.length).toBeLessThan(90);
    expect(label.endsWith('…')).toBe(true);
  });

  it('names a single line in the singular', () => {
    expect(hunkLabel({ hunk: hunk({ newStart: 7, newLines: 1 }) })).toBe('Line 7');
  });

  it('says what was removed when the hunk adds nothing', () => {
    expect(hunkLabel({ hunk: hunk({ oldStart: 4, oldLines: 3, newLines: 0 }) })).toBe(
      'Lines 4-6 removed',
    );
    expect(hunkLabel({ hunk: hunk({ oldStart: 4, oldLines: 1, newLines: 0 }) })).toBe(
      'Line 4 removed',
    );
  });
});
