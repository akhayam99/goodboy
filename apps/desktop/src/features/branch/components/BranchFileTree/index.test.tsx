// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { BranchFileTree } from '.';

installFakeResizeObserver();

afterEach(cleanup);

const fileAt = ({
  path,
  additions,
  deletions,
}: {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}): FileDiff => ({ path, status: 'modified', additions, deletions, binary: false, hunks: [] });

const FILES = [
  fileAt({ path: 'src/ledger/page.tsx', additions: 12, deletions: 3 }),
  fileAt({ path: 'src/ledger/csv.ts', additions: 44, deletions: 0 }),
  fileAt({ path: 'src/types/types.ts', additions: 5, deletions: 1 }),
];

const viewedWith =
  ({ paths }: { readonly paths: ReadonlyArray<string> }) =>
  (file: FileDiff): boolean =>
    paths.includes(file.path);

describe('BranchFileTree', () => {
  it('lists the files under their folders with their counts', () => {
    render(
      <BranchFileTree
        files={FILES}
        isViewed={viewedWith({ paths: [] })}
        activePath={null}
        onPick={() => undefined}
      />,
    );

    expect(screen.getByText('src/ledger')).toBeDefined();
    expect(screen.getByText('src/types')).toBeDefined();
    const page = screen.getByRole('button', { name: /page\.tsx/ });
    expect(page.textContent).toContain('+12');
    expect(page.textContent).toContain('−3');
  });

  it('counts viewed files and marks them', () => {
    render(
      <BranchFileTree
        files={FILES}
        isViewed={viewedWith({ paths: ['src/ledger/csv.ts'] })}
        activePath={null}
        onPick={() => undefined}
      />,
    );

    expect(screen.getByText('1 of 3 viewed')).toBeDefined();
    expect(screen.getAllByLabelText('Viewed')).toHaveLength(1);
  });

  it('picks the full path of the clicked file and marks the active one', () => {
    const onPick = vi.fn();
    render(
      <BranchFileTree
        files={FILES}
        isViewed={viewedWith({ paths: [] })}
        activePath="src/types/types.ts"
        onPick={onPick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /csv\.ts/ }));

    expect(onPick).toHaveBeenCalledWith('src/ledger/csv.ts');
    expect(screen.getByRole('button', { name: /types\.ts/ }).getAttribute('aria-current')).toBe(
      'true',
    );
  });
});
