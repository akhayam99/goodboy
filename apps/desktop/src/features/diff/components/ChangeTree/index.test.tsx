// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { buildChangeTree } from '../../lib/changeTree';
import { ChangeTree } from '.';
import { KEY_HELP } from './keyHelp';

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
      onCommentOnFile={null}
      stateOf={() => 'none'}
      noteCountOf={() => 0}
      {...overrides}
    />,
  );

afterEach(cleanup);

describe('ChangeTree on a big change', () => {
  const BIG = Array.from({ length: 600 }, (_, index) =>
    fileAt(`src/f${String(index).padStart(3, '0')}.ts`),
  );
  const renderBig = () =>
    renderTree({ tree: buildChangeTree({ files: BIG }), allFiles: BIG, collapsed: new Set() });

  it('draws a screenful of rows, not all 600', () => {
    renderBig();

    const drawn = screen.getAllByRole('button', { name: /f\d{3}\.ts/ });
    expect(drawn.length).toBeGreaterThan(10);
    expect(drawn.length).toBeLessThan(80);
    expect(screen.getByText('0 of 600 viewed')).toBeDefined();
  });

  it('swaps the drawn rows as the list scrolls and keeps the scroll height', () => {
    renderBig();
    const list = screen.getByRole('list');
    const viewport = list.parentElement as HTMLElement;
    const heightBefore =
      list.style.paddingTop === '' ? 0 : Number.parseInt(list.style.paddingTop, 10);

    Object.defineProperty(viewport, 'scrollTop', { value: 5000, configurable: true });
    fireEvent.scroll(viewport);

    expect(screen.queryByRole('button', { name: /f000\.ts/ })).toBeNull();
    expect(screen.getByRole('button', { name: /f180\.ts/ })).toBeDefined();
    expect(Number.parseInt(list.style.paddingTop, 10)).toBeGreaterThan(heightBefore);
  });

  it('draws every row of a small change without windowing', () => {
    renderTree();

    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole('list').style.paddingTop).toBe('');
  });
});

describe('ChangeTree', () => {
  it('ends with a single line that teaches the keys', () => {
    renderTree();

    expect(screen.getByText(KEY_HELP)).toBeDefined();
    expect(KEY_HELP).toContain('J K move');
    expect(KEY_HELP).toContain('viewed');
    expect(KEY_HELP).toContain('/ filter');
    expect(screen.getByRole('button', { name: '? all keys' })).toBeDefined();
  });

  it('shows no count or +/- on an expanded folder, its files carry them in colour', () => {
    renderTree();

    const folder = screen.getByRole('button', { name: /\bexport\b/ });
    expect(within(folder).queryByText('2')).toBeNull();
    expect(within(folder).queryByText('+6')).toBeNull();
    const file = screen.getByRole('button', { name: /page\.tsx/ });
    expect(within(file).getByText('+3').className).toContain('text-success');
    expect(within(file).getByText('−1').className).toContain('text-danger');
  });

  it('shows a collapsed folder count and +/- in one muted tone', () => {
    renderTree({ collapsed: new Set(['dir:src/ledger/export']) });

    const folder = screen.getByRole('button', { name: /\bexport\b/ });
    const count = within(folder).getByText('2');
    const additions = within(folder).getByText('+6');
    const deletions = within(folder).getByText('−2');
    [count, additions, deletions].forEach((node) => {
      expect(node.className).toContain('text-faint-foreground');
      expect(node.className).not.toContain('text-success');
      expect(node.className).not.toContain('text-danger');
    });
  });

  it('shows files with their status letter and rename source', () => {
    renderTree();

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
    expect(onToggleFolder).toHaveBeenCalledWith('dir:src/ledger/export');

    rerender(
      <ChangeTree
        tree={buildChangeTree({ files: FILES })}
        allFiles={FILES}
        filter={NO_FILTER}
        filterRef={createRef()}
        activePath={null}
        collapsed={new Set(['dir:src/ledger/export'])}
        onToggleFolder={onToggleFolder}
        onPick={vi.fn()}
        onCommentOnFile={null}
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
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Kind/ }));

    expect(onUnviewedOnly).toHaveBeenCalledWith(true);
    expect(onNotesOnly).toHaveBeenCalledWith(true);
    expect(onGroup).toHaveBeenCalledWith('kind');
  });

  it('sends the typed query to the filter and clears it on Escape', () => {
    const onQuery = vi.fn();
    renderTree({ filter: { ...NO_FILTER, query: 'csv', onQuery } });

    const input = screen.getByRole('textbox', { name: 'Filter files' });
    fireEvent.change(input, { target: { value: 'csvx' } });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    expect(onQuery).toHaveBeenCalledWith('csvx');
    expect(onQuery).toHaveBeenCalledWith('');
  });

  it('offers a comment action on a file row that reaches the same keyboard focus as the row', () => {
    const onCommentOnFile = vi.fn();
    const onPick = vi.fn();
    renderTree({ onCommentOnFile, onPick });

    const action = screen.getByRole('button', { name: 'Comment on page.tsx' });
    fireEvent.click(action);

    expect(onCommentOnFile).toHaveBeenCalledWith('src/ledger/export/page.tsx');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keeps the comment action a real button a keyboard can reach next to its row', () => {
    renderTree({ onCommentOnFile: vi.fn() });

    const row = screen.getByTitle('src/ledger/export/page.tsx');
    const action = screen.getByRole('button', { name: 'Comment on page.tsx' });

    expect(action.tabIndex).toBe(0);
    expect(row.closest('li')).toBe(action.closest('li'));
  });

  it('has no comment action on rows when file comments are off', () => {
    renderTree();

    expect(screen.queryByRole('button', { name: /Comment on/ })).toBeNull();
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
