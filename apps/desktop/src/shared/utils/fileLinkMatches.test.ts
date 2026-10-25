// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileLinkMatches } from './fileLinkMatches';

const pathsOf = (text: string) => fileLinkMatches({ text }).map((match) => match.path);

describe('fileLinkMatches', () => {
  it('finds a path with a line and a column', () => {
    expect(fileLinkMatches({ text: ' FAIL src/billing/rounding.ts:42:13 expected 2' })).toEqual([
      { startIndex: 6, endIndex: 35, path: 'src/billing/rounding.ts', line: 42, column: 13 },
    ]);
  });

  it('finds the parenthesised form a compiler prints', () => {
    expect(fileLinkMatches({ text: 'src/ledger.ts(7,3): error TS2322' })).toEqual([
      { startIndex: 0, endIndex: 18, path: 'src/ledger.ts', line: 7, column: 3 },
    ]);
  });

  it('takes a relative path without a line when it has a folder', () => {
    expect(pathsOf('see ./tools/replay.mjs and ../shared/types.d.ts now')).toEqual([
      './tools/replay.mjs',
      '../shared/types.d.ts',
    ]);
  });

  it('takes a bare file name only with a line', () => {
    expect(pathsOf('rounding.ts:9 and package.json and v1.2.3')).toEqual(['rounding.ts']);
  });

  it('leaves urls to the web link handler', () => {
    expect(
      pathsOf('open http://localhost:4310/app/main.js or https://harborline.test/a/b.html'),
    ).toEqual([]);
  });

  it('keeps an absolute path', () => {
    expect(pathsOf('at /work/notify-relay/src/queue.ts:88:5')).toEqual([
      '/work/notify-relay/src/queue.ts',
    ]);
  });

  it('ignores a sentence end and a version', () => {
    expect(pathsOf('Done in 3.2s. Built v0.27.36.')).toEqual([]);
  });

  it('links nothing in a line past the cap and little in a dense one', () => {
    const text = `${'a/'.repeat(5000)}b`;
    expect(fileLinkMatches({ text })).toEqual([]);
    const dense = `${'a.'.repeat(900)}b/c`;
    expect(fileLinkMatches({ text: dense }).length).toBeLessThan(2);
  });
});
