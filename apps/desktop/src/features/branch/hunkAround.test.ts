// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { hunkAround } from './hunkAround';

const FILE: FileDiff = {
  path: 'src/ledger/page.tsx',
  status: 'modified',
  additions: 1,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '@@ -18,6 +18,6 @@',
      oldStart: 18,
      oldLines: 6,
      newStart: 18,
      newLines: 6,
      lines: [
        {
          kind: 'context',
          oldLine: 18,
          newLine: 18,
          text: 'export async function exportLedger() {',
        },
        { kind: 'context', oldLine: 19, newLine: 19, text: '  const rows = await loadRows(slug)' },
        { kind: 'del', oldLine: 20, newLine: null, text: '  const id = slug' },
        { kind: 'add', oldLine: null, newLine: 20, text: '  const id = slug as LedgerId' },
        { kind: 'context', oldLine: 21, newLine: 21, text: '  return buildCsv(id, rows)' },
        { kind: 'context', oldLine: 22, newLine: 22, text: '}' },
      ],
    },
  ],
};

describe('hunkAround', () => {
  it('returns the lines around a commented line, matching a repo relative path', () => {
    const window = hunkAround({
      files: [FILE],
      path: 'apps/web/src/ledger/page.tsx',
      line: 20,
      radius: 1,
    });
    expect(window?.lines.map((line) => line.text)).toEqual([
      '  const id = slug',
      '  const id = slug as LedgerId',
      '  return buildCsv(id, rows)',
    ]);
    expect(window?.anchorLine).toBe(20);
  });

  it('gives nothing for a file outside the diff or a line outside every hunk', () => {
    expect(hunkAround({ files: [FILE], path: 'src/other.ts', line: 20 })).toBeNull();
    expect(hunkAround({ files: [FILE], path: FILE.path, line: 99 })).toBeNull();
    expect(hunkAround({ files: [FILE], path: FILE.path, line: null })).toBeNull();
  });
});
