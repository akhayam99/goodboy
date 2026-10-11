// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { buildChangeTree } from '../../lib/changeTree';
import { NO_KINDS } from '../../lib/commentKinds';
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
  commentedOnly: false,
  onCommentedOnly: vi.fn(),
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
      commentCountOf={() => 0}
      kindsOf={() => NO_KINDS}
      isReadOnly={false}
      onToggleViewed={vi.fn()}
      onNextUnviewed={vi.fn()}
      onLeave={vi.fn()}
      {...overrides}
    />,
  );

const itemOf = (name: RegExp): HTMLElement => screen.getByRole('treeitem', { name });

const rowById = (id: string): HTMLElement => {
  const row = screen.getAllByRole('treeitem').find((item) => item.dataset.treeRow === id);
  if (row === undefined) {
    throw new Error(`no row ${id}`);
  }
  return row;
};

const tree = (): HTMLElement => screen.getByRole('tree', { name: 'Changed files' });

const press = (key: string): void => {
  fireEvent.keyDown(tree(), { key });
};

const focusTree = (): void => {
  act(() => tree().focus());
  fireEvent.focus(tree());
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ChangeTree on a big change', () => {
  const BIG = Array.from({ length: 600 }, (_, index) =>
    fileAt(`src/f${String(index).padStart(3, '0')}.ts`),
  );
  const renderBig = () =>
    renderTree({ tree: buildChangeTree({ files: BIG }), allFiles: BIG, collapsed: new Set() });

  it('draws a screenful of rows, not all 600', () => {
    renderBig();

    const drawn = screen.getAllByRole('treeitem', { name: /f\d{3}\.ts/ });
    expect(drawn.length).toBeGreaterThan(10);
    expect(drawn.length).toBeLessThan(80);
    expect(screen.queryByText(/of 600 viewed/)).toBeNull();
  });

  it('swaps the drawn rows as the list scrolls and keeps the scroll height', () => {
    renderBig();
    const list = tree();
    const viewport = list.parentElement as HTMLElement;
    const heightBefore =
      list.style.paddingTop === '' ? 0 : Number.parseInt(list.style.paddingTop, 10);

    Object.defineProperty(viewport, 'scrollTop', { value: 5000, configurable: true });
    fireEvent.scroll(viewport);

    expect(screen.queryByRole('treeitem', { name: /f000\.ts/ })).toBeNull();
    expect(screen.getByRole('treeitem', { name: /f180\.ts/ })).toBeDefined();
    expect(Number.parseInt(list.style.paddingTop, 10)).toBeGreaterThan(heightBefore);
  });

  it('draws every row of a small change without windowing', () => {
    renderTree();

    expect(screen.getAllByRole('treeitem').length).toBeGreaterThanOrEqual(6);
    expect(tree().style.paddingTop).toBe('');
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

  it('shows no count or +/- on an expanded folder, and the +/- on a file only at 340 or more', () => {
    const observers = installFakeResizeObserver();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 360, 600),
    );
    renderTree();
    act(() => observers.resizeAll());

    const folder = itemOf(/\bexport\b/);
    expect(within(folder).queryByText('2')).toBeNull();
    expect(within(folder).queryByText('+6')).toBeNull();
    expect(
      within(itemOf(/page\.tsx/))
        .getByText('+3')
        .closest('[data-tone]')
        ?.getAttribute('data-tone'),
    ).toBe('diff');

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 300, 600),
    );
    act(() => observers.resizeAll());

    expect(within(itemOf(/page\.tsx/)).queryByText('+3')).toBeNull();
  });

  it('shows a collapsed folder count and +/- in one muted tone', () => {
    renderTree({ collapsed: new Set(['dir:src/ledger/export']) });

    const folder = itemOf(/\bexport\b/);
    const tones = ['2', '+6', '−2'].map((text) =>
      within(folder).getByText(text).closest('[data-tone]')?.getAttribute('data-tone'),
    );
    expect(tones).toEqual(['muted', 'muted', 'muted']);
  });

  it('shows files with their status letter and rename source', () => {
    renderTree();

    expect(screen.getByLabelText('Renamed').textContent).toBe('R');
    expect(screen.getByLabelText('Deleted').textContent).toBe('D');
    expect(screen.getByText('from src/ledger/csv.ts')).toBeDefined();
  });

  it('lays rows out as a tree: one level deeper per folder, folders expanded by role', () => {
    renderTree();

    expect(rowById('dir:src/ledger').getAttribute('aria-level')).toBe('1');
    expect(rowById('dir:src/ledger/export').getAttribute('aria-level')).toBe('2');
    expect(rowById('src/ledger/export/page.tsx').getAttribute('aria-level')).toBe('3');
    expect(rowById('dir:src/ledger/export').getAttribute('aria-expanded')).toBe('true');
  });

  it('jumps to a file on click', () => {
    const onPick = vi.fn();
    renderTree({ onPick });

    fireEvent.click(within(itemOf(/page\.tsx/)).getByRole('button', { name: /^page\.tsx/ }));

    expect(onPick).toHaveBeenCalledWith('src/ledger/export/page.tsx');
  });

  it('toggles a folder and hides its files while collapsed', () => {
    const onToggleFolder = vi.fn();
    const { rerender } = renderTree({ onToggleFolder });

    fireEvent.click(within(itemOf(/\bexport\b/)).getByRole('button'));
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
        stateOf={() => 'none'}
        commentCountOf={() => 0}
        kindsOf={() => NO_KINDS}
        isReadOnly={false}
        onToggleViewed={vi.fn()}
        onNextUnviewed={vi.fn()}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.queryByRole('treeitem', { name: /page\.tsx/ })).toBeNull();
    expect(itemOf(/\bexport\b/).getAttribute('aria-expanded')).toBe('false');
  });

  it('leaks no folder id into a native title', () => {
    renderTree({ collapsed: new Set(['dir:src/ledger/export']) });

    const titled = Array.from(document.querySelectorAll('[title]'));
    expect(titled.filter((node) => (node.getAttribute('title') ?? '').startsWith('dir:'))).toEqual(
      [],
    );
    expect(document.querySelector('[title="src/ledger/export/page.tsx"]')).toBeNull();
  });

  it('shows the full path of a folder and a file in a tooltip on hover', async () => {
    vi.useFakeTimers();
    try {
      renderTree();

      fireEvent.mouseEnter(within(itemOf(/\bexport\b/)).getByRole('button'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(screen.getByRole('tooltip').textContent).toBe('src/ledger/export');

      fireEvent.mouseLeave(within(itemOf(/\bexport\b/)).getByRole('button'));
      fireEvent.mouseEnter(within(itemOf(/page\.tsx/)).getByText('page.tsx'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(screen.getByRole('tooltip').textContent).toBe('src/ledger/export/page.tsx');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dots the closed folder that holds the file in view and nothing else', () => {
    renderTree({
      activePath: 'src/ledger/export/page.tsx',
      collapsed: new Set(['dir:src/ledger/export']),
    });

    const folder = itemOf(/\bexport\b/);
    expect(within(folder).getByRole('img', { name: 'contains the file in view' })).toBeDefined();
    expect(screen.getAllByRole('img', { name: 'contains the file in view' })).toHaveLength(1);
  });

  it('dots the outermost closed folder when two are closed above the file', () => {
    renderTree({
      activePath: 'src/ledger/export/page.tsx',
      collapsed: new Set(['dir:src/ledger/export', 'dir:src/ledger']),
    });

    const folder = itemOf(/\bledger\b/);
    expect(within(folder).getByRole('img', { name: 'contains the file in view' })).toBeDefined();
    expect(screen.getAllByRole('img', { name: 'contains the file in view' })).toHaveLength(1);
  });

  it('shows no dot while the folder of the file in view is open', () => {
    renderTree({ activePath: 'src/ledger/export/page.tsx' });

    expect(screen.queryByRole('img', { name: 'contains the file in view' })).toBeNull();
  });

  it('marks the active file and scrolls its row into view', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderTree({ activePath: 'package.json' });

    expect(itemOf(/package\.json/).getAttribute('aria-current')).toBe('true');
    expect(itemOf(/page\.tsx/).getAttribute('aria-current')).toBeNull();
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

  it('puts a viewed toggle first on every file row and calls it with the file', () => {
    const onToggleViewed = vi.fn();
    renderTree({
      onToggleViewed,
      stateOf: (file) => (file.path === 'package.json' ? 'viewed' : 'none'),
    });

    const done = within(itemOf(/package\.json/)).getByRole('button', {
      name: 'Viewed: package.json',
    });
    const open = within(itemOf(/page\.tsx/)).getByRole('button', { name: 'Viewed: page.tsx' });
    expect(done.getAttribute('aria-pressed')).toBe('true');
    expect(open.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(open);

    expect(onToggleViewed).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/ledger/export/page.tsx' }),
    );
  });

  it('offers no viewed toggle on a read only change', () => {
    renderTree({ isReadOnly: true });

    expect(screen.queryByRole('button', { name: /^Viewed:/ })).toBeNull();
  });

  it('marks a file that changed after it was viewed with an amber dot, still unviewed', () => {
    renderTree({
      stateOf: (file) => (file.path === 'package.json' ? 'stale' : 'none'),
    });

    const toggle = within(itemOf(/package\.json/)).getByRole('button', {
      name: 'Viewed: package.json',
    });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.querySelector('span')).not.toBeNull();
    expect(screen.getByRole('tab', { name: /^Unviewed/ }).textContent).toContain('4');
  });

  it('counts the unviewed and the commented files on the filter', () => {
    renderTree({
      stateOf: (file) => (file.path === 'package.json' ? 'viewed' : 'none'),
      commentCountOf: (path) => (path === 'src/ledger/export/page.tsx' ? 3 : 0),
      kindsOf: (path) =>
        path === 'src/ledger/export/page.tsx'
          ? { notes: 2, host: 1, hostLabel: 'GitHub' }
          : NO_KINDS,
    });

    expect(screen.getByRole('tab', { name: /^Unviewed/ }).textContent).toContain('3');
    expect(screen.getByRole('tab', { name: /^Commented/ }).textContent).toContain('1');
  });

  it('shows the comment count of a file and names its kinds in the tooltip', async () => {
    vi.useFakeTimers();
    try {
      renderTree({
        commentCountOf: (path) => (path === 'src/ledger/export/page.tsx' ? 3 : 0),
        kindsOf: (path) =>
          path === 'src/ledger/export/page.tsx'
            ? { notes: 2, host: 1, hostLabel: 'GitHub' }
            : NO_KINDS,
      });

      const chip = screen.getByRole('img', { name: '2 notes, 1 on GitHub' });
      expect(chip.textContent).toBe('3');
      fireEvent.mouseEnter(chip.parentElement as HTMLElement);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(screen.getByRole('tooltip').textContent).toBe('2 notes, 1 on GitHub');
    } finally {
      vi.useRealTimers();
    }
  });

  it('names a file with only pull request threads by the host', () => {
    renderTree({
      commentCountOf: (path) => (path === 'package.json' ? 1 : 0),
      kindsOf: (path) =>
        path === 'package.json' ? { notes: 0, host: 1, hostLabel: 'GitLab' } : NO_KINDS,
    });

    expect(screen.getByRole('img', { name: '1 on GitLab' })).toBeDefined();
  });

  it('cuts a long name from the middle and keeps the whole name for a screen reader', () => {
    const observers = installFakeResizeObserver();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 230, 600),
    );
    const files = [fileAt('StatementBalanceCard.test.tsx')];
    renderTree({ tree: buildChangeTree({ files }), allFiles: files });
    act(() => observers.resizeAll());

    const row = itemOf(/StatementBalanceCard\.test\.tsx/);
    expect(within(row).getByText('Statem…ceCard.test.tsx')).toBeDefined();
    expect(within(row).getByText('StatementBalanceCard.test.tsx')).toBeDefined();
  });

  it('jumps to the next unviewed file from its footer button and says how many are left', () => {
    const onNextUnviewed = vi.fn();
    renderTree({
      stateOf: (file) => (file.path === 'package.json' ? 'viewed' : 'none'),
      onNextUnviewed,
    });

    const next = screen.getByRole('button', { name: /^Next unviewed/ });
    expect(next.textContent).toContain('3');
    fireEvent.click(next);
    expect(onNextUnviewed).toHaveBeenCalledTimes(1);
  });

  it('disables Next unviewed once every file is viewed', () => {
    renderTree({ stateOf: () => 'viewed' });

    expect(screen.getByRole('button', { name: /^Next unviewed/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('keeps the counts on every file while the tree shows only the filtered ones', () => {
    const onClear = vi.fn();
    const shown = FILES.filter((file) => file.path === 'package.json');
    renderTree({
      tree: buildChangeTree({ files: shown }),
      filter: { ...NO_FILTER, query: 'pack', isFiltering: true, onClear },
    });

    expect(screen.getByRole('tab', { name: /^Unviewed/ }).textContent).toContain('4');
    expect(screen.getByText('Showing 1 of 4')).toBeDefined();
    expect(screen.queryByRole('treeitem', { name: /page\.tsx/ })).toBeNull();

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

  it('shows all, unviewed or commented files one at a time and switches the grouping', () => {
    const onUnviewedOnly = vi.fn();
    const onCommentedOnly = vi.fn();
    const onGroup = vi.fn();
    renderTree({ filter: { ...NO_FILTER, onUnviewedOnly, onCommentedOnly, onGroup } });

    expect(screen.getByRole('tab', { name: 'All' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: /^Unviewed/ }));
    expect(onUnviewedOnly).toHaveBeenLastCalledWith(true);
    expect(onCommentedOnly).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('tab', { name: /^Commented/ }));
    expect(onUnviewedOnly).toHaveBeenLastCalledWith(false);
    expect(onCommentedOnly).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Group files' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Kind/ }));

    expect(onGroup).toHaveBeenCalledWith('kind');
  });

  it('reads the filter back from the two switches, unviewed first', () => {
    renderTree({ filter: { ...NO_FILTER, unviewedOnly: true } });
    expect(screen.getByRole('tab', { name: /^Unviewed/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    cleanup();

    renderTree({ filter: { ...NO_FILTER, commentedOnly: true } });
    expect(screen.getByRole('tab', { name: /^Commented/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
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

  it('has no comment action on rows: a comment starts in the file header', () => {
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

    const row = itemOf(/Generated/);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('treeitem', { name: /pnpm-lock/ })).toBeNull();
  });

  it('shows the folder next to the name in the Kind grouping', () => {
    renderTree({ tree: buildChangeTree({ files: FILES, group: 'kind' }) });

    expect(itemOf(/Source/)).toBeDefined();
    expect(screen.getAllByText('src/ledger/export')).toHaveLength(2);
  });
});

describe('ChangeTree keys', () => {
  it('moves one row with the arrows and to the first and last with Home and End', () => {
    renderTree();
    focusTree();

    expect(tree().getAttribute('aria-activedescendant')).toContain(':dir:src/ledger');
    press('ArrowDown');
    expect(tree().getAttribute('aria-activedescendant')).toContain(':dir:src/ledger/export');
    press('End');
    expect(tree().getAttribute('aria-activedescendant')).toContain(':package.json');
    press('Home');
    expect(tree().getAttribute('aria-activedescendant')).toContain(':dir:src/ledger');
    press('ArrowUp');
    expect(tree().getAttribute('aria-activedescendant')).toContain(':dir:src/ledger');
  });

  it('opens and closes a folder with the side arrows and steps to its parent', () => {
    const onToggleFolder = vi.fn();
    renderTree({ onToggleFolder, collapsed: new Set(['dir:src/ledger/export']) });
    focusTree();
    press('ArrowDown');
    expect(tree().getAttribute('aria-activedescendant')).toContain(':dir:src/ledger/export');

    press('ArrowRight');
    expect(onToggleFolder).toHaveBeenLastCalledWith('dir:src/ledger/export');

    press('ArrowLeft');
    expect(tree().getAttribute('aria-activedescendant')).toContain(':dir:src/ledger');
    press('ArrowLeft');
    expect(onToggleFolder).toHaveBeenLastCalledWith('dir:src/ledger');
  });

  it('jumps the diff on Enter and keeps focus in the tree', () => {
    const onPick = vi.fn();
    renderTree({ onPick });
    focusTree();
    press('End');

    press('Enter');

    expect(onPick).toHaveBeenCalledWith('package.json');
    expect(document.activeElement).toBe(tree());
  });

  it('toggles viewed on Space for a file and folds a folder', () => {
    const onToggleViewed = vi.fn();
    const onToggleFolder = vi.fn();
    renderTree({ onToggleViewed, onToggleFolder });
    focusTree();

    press(' ');
    expect(onToggleFolder).toHaveBeenLastCalledWith('dir:src/ledger');
    expect(onToggleViewed).not.toHaveBeenCalled();

    press('End');
    press(' ');
    expect(onToggleViewed).toHaveBeenCalledWith(expect.objectContaining({ path: 'package.json' }));
  });

  it('does not toggle viewed on a read only change', () => {
    const onToggleViewed = vi.fn();
    renderTree({ onToggleViewed, isReadOnly: true });
    focusTree();
    press('End');

    press(' ');

    expect(onToggleViewed).not.toHaveBeenCalled();
  });

  it('returns to the diff on Escape', () => {
    const onLeave = vi.fn();
    renderTree({ onLeave });
    focusTree();

    fireEvent.keyDown(tree(), { key: 'Escape', code: 'Escape' });

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('stops listening for Escape once the tree loses focus', () => {
    const onLeave = vi.fn();
    renderTree({ onLeave });
    focusTree();
    fireEvent.blur(tree());

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onLeave).not.toHaveBeenCalled();
  });
});
