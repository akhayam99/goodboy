import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { DiffHunk } from '@goodboy/types';
import { buildDiffStreams, tokensForLine, useDiffTokens } from '.';

const HUNK: DiffHunk = {
  header: '@@ -1,3 +1,3 @@',
  oldStart: 1,
  oldLines: 3,
  newStart: 1,
  newLines: 3,
  lines: [
    { kind: 'context', oldLine: 1, newLine: 1, text: '/* ledger-core' },
    { kind: 'del', oldLine: 2, newLine: null, text: '   old rate */' },
    { kind: 'add', oldLine: null, newLine: 2, text: '   new rate */' },
    { kind: 'context', oldLine: 3, newLine: 3, text: 'const rate = 1;' },
  ],
};

describe('buildDiffStreams', () => {
  it('splits each hunk into an old and a new stream', () => {
    const streams = buildDiffStreams([HUNK]);
    expect(streams).toHaveLength(2);
    expect(streams[0]?.code).toBe('/* ledger-core\n   old rate */\nconst rate = 1;');
    expect(streams[0]?.keys).toEqual(['', 'o2', '']);
    expect(streams[1]?.keys).toEqual(['n1', 'n2', 'n3']);
  });
});

describe('useDiffTokens', () => {
  it('tokenizes deleted lines with the old side state', async () => {
    const hunks = [HUNK];
    const { result } = renderHook(() => useDiffTokens({ path: 'ledger-core/rate.js', hunks }));
    await waitFor(() => expect(result.current).not.toBeNull(), { timeout: 10000 });
    const deleted = tokensForLine(result.current, HUNK.lines[1]!);
    expect(deleted?.find((token) => token.text.includes('old'))?.kind).toBe('comment');
    const added = tokensForLine(result.current, HUNK.lines[2]!);
    expect(added?.find((token) => token.text.includes('new'))?.kind).toBe('comment');
  });

  it('stays null for unknown languages', () => {
    const { result } = renderHook(() => useDiffTokens({ path: 'NOTES', hunks: [HUNK] }));
    expect(result.current).toBeNull();
  });
});
