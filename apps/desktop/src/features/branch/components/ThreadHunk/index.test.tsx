// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import type { ResolveQueueRow } from '../../../resolve/buildResolveQueueRows';
import { ThreadHunk } from '.';

const FILE: FileDiff = {
  path: 'payments-api/src/retry.ts',
  status: 'modified',
  additions: 2,
  deletions: 0,
  binary: false,
  hunks: [
    {
      header: '@@ -10,2 +10,4 @@',
      oldStart: 10,
      oldLines: 2,
      newStart: 10,
      newLines: 4,
      lines: [
        { kind: 'context', oldLine: 10, newLine: 10, text: 'const settle = () => {' },
        {
          kind: 'add',
          oldLine: null,
          newLine: 11,
          text: "  metrics.increment('retry_backoff_exhausted');",
        },
        { kind: 'context', oldLine: 11, newLine: 12, text: '};' },
      ],
    },
  ],
};

vi.mock('../../branchDiffContext', () => ({
  useBranchDiff: () => ({ files: [FILE], bodies: null }),
}));

vi.mock('../../../resolve/threadLocationOf', () => ({
  threadLocationOf: () => ({
    label: 'retry.ts:11',
    shortLabel: 'retry.ts:11',
    path: FILE.path,
    line: 11,
  }),
}));

afterEach(cleanup);

describe('the thread hunk', () => {
  it('hangs wrapped code lines under the code, not under the gutter', () => {
    const row: ResolveQueueRow = Object.create(null);
    render(<ThreadHunk row={row} onOpenInDiff={null} />);

    const figure = screen.getByRole('figure', { name: 'Code around the comment' });
    const code = figure.querySelector<HTMLElement>('p:nth-of-type(2) > span:last-child');
    expect(code?.textContent).toBe("  metrics.increment('retry_backoff_exhausted');");
    expect(code?.style.textIndent).toBe('-2ch');
    expect(code?.style.paddingInlineStart).toBe('2ch');
  });
});
