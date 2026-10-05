// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { buildChangeTree } from '../../lib/changeTree';
import { ChangeTree } from '.';

const fileAt = (path: string, extra: Partial<FileDiff> = {}): FileDiff => ({
  path,
  status: 'modified',
  additions: 3,
  deletions: 1,
  binary: false,
  hunks: [],
  ...extra,
});

const FILES = [
  fileAt('src/ledger/export/page.tsx'),
  fileAt('src/ledger/export/csv.ts', { status: 'renamed', oldPath: 'src/ledger/csv.ts' }),
  fileAt('src/ledger/legacyExport.ts', { status: 'deleted', additions: 0, deletions: 40 }),
  fileAt('package.json'),
];

const renderTree = (overrides: Partial<Parameters<typeof ChangeTree>[0]> = {}) =>
  render(
    <ChangeTree
      tree={buildChangeTree({ files: FILES })}
      activePath={null}
      collapsed={new Set()}
      onToggleFolder={vi.fn()}
      onPick={vi.fn()}
      stateOf={() => 'none'}
      noteCountOf={() => 0}
      {...overrides}
    />,
  );

afterEach(cleanup);

describe('ChangeTree', () => {
  it('shows folders with their file counts and sums, files with their status letter', () => {
    renderTree();

    const folder = screen.getByRole('button', { name: /^export/ });
    expect(within(folder).getByText('2')).toBeDefined();
    expect(within(folder).getByText('+6')).toBeDefined();
    expect(screen.getByLabelText('Renamed').textContent).toBe('R');
    expect(screen.getByLabelText('Deleted').textContent).toBe('D');
    expect(screen.getByText('from src/ledger/csv.ts')).toBeDefined();
  });

  it('jumps to a file on click', () => {
    const onPick = vi.fn();
    renderTree({ onPick });

    fireEvent.click(screen.getByRole('button', { name: /page\.tsx/ }));

    expect(onPick).toHaveBeenCalledWith('src/ledger/export/page.tsx');
  });

  it('toggles a folder and hides its files while collapsed', () => {
    const onToggleFolder = vi.fn();
    const { rerender } = renderTree({ onToggleFolder });

    fireEvent.click(screen.getByRole('button', { name: /^export/ }));
    expect(onToggleFolder).toHaveBeenCalledWith('src/ledger/export');

    rerender(
      <ChangeTree
        tree={buildChangeTree({ files: FILES })}
        activePath={null}
        collapsed={new Set(['src/ledger/export'])}
        onToggleFolder={onToggleFolder}
        onPick={vi.fn()}
        stateOf={() => 'none'}
        noteCountOf={() => 0}
      />,
    );
    expect(screen.queryByRole('button', { name: /page\.tsx/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^export/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('marks the active file and scrolls its row into view', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderTree({ activePath: 'package.json' });

    expect(screen.getByRole('button', { name: /package\.json/ }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: /page\.tsx/ }).getAttribute('aria-current'),
    ).toBeNull();
    expect(scroll).toHaveBeenCalled();
  });

  it('counts viewed files in the head and shows notes on a file', () => {
    renderTree({
      stateOf: (file) => (file.path === 'package.json' ? 'viewed' : 'none'),
      noteCountOf: (path) => (path === 'src/ledger/export/page.tsx' ? 2 : 0),
    });

    expect(screen.getByText('1 of 4 viewed')).toBeDefined();
    expect(screen.getByLabelText('2 notes')).toBeDefined();
  });
});
