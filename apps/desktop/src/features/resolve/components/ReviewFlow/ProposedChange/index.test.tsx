// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { ProposedChange } from '.';

const FILES: ReadonlyArray<FileDiff> = [
  {
    path: 'notify-relay/src/retry.ts',
    status: 'modified',
    additions: 1,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -10,1 +10,2 @@',
        oldStart: 10,
        oldLines: 1,
        newStart: 10,
        newLines: 2,
        lines: [
          { kind: 'context', oldLine: 10, newLine: 10, text: 'const settle = () => {' },
          {
            kind: 'add',
            oldLine: null,
            newLine: 11,
            text: "  metrics.increment('retry_backoff_exhausted');",
          },
        ],
      },
    ],
  },
];

afterEach(cleanup);

describe('ProposedChange', () => {
  it('hangs wrapped code under the code, not under the sign', () => {
    render(<ProposedChange files={FILES} isLoading={false} error={null} />);

    const group = screen.getByRole('group', { name: 'Proposed change' });
    const code = group.querySelector<HTMLElement>('p:last-of-type > span:last-child');
    expect(code?.textContent).toBe("  metrics.increment('retry_backoff_exhausted');");
    expect(code?.style.textIndent).toBe('-2ch');
    expect(code?.style.paddingInlineStart).toBe('2ch');
  });
});
