// @vitest-environment happy-dom

import { createRef } from 'react';
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

const NO_FILTER = {
  query: '',
  onQuery: vi.fn(),
  unviewedOnly: false,
  onUnviewedOnly: vi.fn(),
  notesOnly: false,
  onNotesOnly: vi.fn(),
  group: 'folders' as const,
  onGroup: vi.fn(),
  isFiltering: false,
  onClear: vi.fn(),
};

const renderTree = (overrides: Partial<Parameters<typeof ChangeTree>[0]> = {}) =>
  render(
    <ChangeTree
      tree={buildChangeTree({ files: FILES })}
      allFiles={FILES}
      filter={NO_FILTER}
      filterRef={createRef()}
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

    const folder = screen.getByRole('button', { name: /\bexport\b/ });
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

    fireEvent.click(screen.getByRole('button', { name: /\bexport\b/ }));
    expect(onToggleFolder).toHaveBeenCalledWith('src/ledger/export');

    rerender(
      <ChangeTree
        tree={buildChangeTree({ files: FILES })}
        allFiles={FILES}
        filter={NO_FILTER}
        filterRef={createRef()}
        activePath={null}
        collapsed={new Set(['src/ledger/export'])}
        onToggleFolder={onToggleFolder}
        onPick={vi.fn()}
        stateOf={() => 'none'}
        noteCountOf={() => 0}
      />,
    );
    expect(screen.queryByRole('button', { name: /page\.tsx/ })).toBeNull();
    expect(screen.getByRole('button', { name: /\bexport\b/ }).getAttribute('aria-expanded')).toBe(
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

  it('draws a ring per folder that fills as its files are viewed', () => {
    renderTree({
      stateOf: (file) => (file.path === 'src/ledger/export/page.tsx' ? 'viewed' : 'none'),
    });

    expect(screen.getByRole('img', { name: '1 of 2 viewed' })).toBeDefined();
    expect(screen.getByRole('img', { name: '1 of 3 viewed' })).toBeDefined();
  });

  it('closes a folder ring with a check once every file in it is viewed', () => {
    renderTree({
      stateOf: (file) => (file.path.startsWith('src/ledger/export/') ? 'viewed' : 'none'),
    });

    const done = screen.getByRole('img', { name: '2 of 2 viewed' });
    expect(done.querySelector('circle')).toBeNull();
  });

  it('marks a file that changed after it was viewed with an amber dot instead of a check', () => {
    renderTree({
      stateOf: (file) => (file.path === 'package.json' ? 'stale' : 'none'),
    });

    expect(screen.getByRole('img', { name: 'Changed since viewed' })).toBeDefined();
    expect(screen.queryByLabelText('Viewed')).toBeNull();
    expect(screen.getByText('0 of 4 viewed')).toBeDefined();
  });

  it('counts viewed files in the head and shows notes on a file', () => {
    renderTree({
      stateOf: (file) => (file.path === 'package.json' ? 'viewed' : 'none'),
      noteCountOf: (path) => (path === 'src/ledger/export/page.tsx' ? 2 : 0),
    });

    expect(screen.getByText('1 of 4 viewed')).toBeDefined();
    expect(screen.getByLabelText('2 notes')).toBeDefined();
  });

  it('keeps the head on every file while the tree shows only the filtered ones', () => {
    const onClear = vi.fn();
    const shown = FILES.filter((file) => file.path === 'package.json');
    renderTree({
      tree: buildChangeTree({ files: shown }),
      filter: { ...NO_FILTER, query: 'pack', isFiltering: true, onClear },
    });

    expect(screen.getByText('0 of 4 viewed')).toBeDefined();
    expect(screen.getByText('Showing 1 of 4')).toBeDefined();
    expect(screen.queryByRole('button', { name: /page\.tsx/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('says nothing matches and offers Clear when the filter hides every file', () => {
    const onClear = vi.fn();
    renderTree({
      tree: buildChangeTree({ files: [] }),
      filter: { ...NO_FILTER, query: 'zzz', isFiltering: true, onClear },
    });

    expect(screen.getByText('No files match.')).toBeDefined();
    expect(screen.getByText('Showing 0 of 4')).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[1] as HTMLElement);
    expect(onClear).toHaveBeenCalled();
  });

  it('toggles the Unviewed and With notes chips and switches the grouping', () => {
    const onUnviewedOnly = vi.fn();
    const onNotesOnly = vi.fn();
    const onGroup = vi.fn();
    renderTree({ filter: { ...NO_FILTER, onUnviewedOnly, onNotesOnly, onGroup } });

    fireEvent.click(screen.getByRole('button', { name: 'Unviewed' }));
    fireEvent.click(screen.getByRole('button', { name: 'With notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Group files' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Kind/ }));

    expect(onUnviewedOnly).toHaveBeenCalledWith(true);
    expect(onNotesOnly).toHaveBeenCalledWith(true);
    expect(onGroup).toHaveBeenCalledWith('kind');
  });

  it('sends the typed query to the filter and clears it on Escape', () => {
    const onQuery = vi.fn();
    renderTree({ filter: { ...NO_FILTER, query: 'csv', onQuery } });

    const input = screen.getByRole('textbox', { name: 'Filter files' });
    fireEvent.change(input, { target: { value: 'csvx' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onQuery).toHaveBeenCalledWith('csvx');
    expect(onQuery).toHaveBeenCalledWith('');
  });

  it('lists generated files in a Generated row at the bottom', () => {
    const files = [...FILES, fileAt('pnpm-lock.yaml', { additions: 400, deletions: 90 })];
    renderTree({
      tree: buildChangeTree({ files }),
      allFiles: files,
      collapsed: new Set(['group:generated']),
    });

    const row = screen.getByRole('button', { name: /Generated/ });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /pnpm-lock/ })).toBeNull();
  });

  it('shows the folder next to the name in the Kind grouping', () => {
    renderTree({ tree: buildChangeTree({ files: FILES, group: 'kind' }) });

    expect(screen.getByRole('button', { name: /Source/ })).toBeDefined();
    expect(screen.getAllByText('src/ledger/export')).toHaveLength(2);
  });
});
