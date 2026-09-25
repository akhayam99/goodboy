// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { FileDiff, IsoDateTime } from '@goodboy/types';
import { DiffView } from '.';
import type { DiffComments, DiffThread } from './types';

vi.mock('../../hooks/useDiffTokens', () => ({
  useDiffTokens: () => null,
  tokensForLine: () => null,
}));

const LEDGER: FileDiff = {
  path: 'ledger-core/src/allocation/allocate.ts',
  status: 'modified',
  additions: 3,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '@@ -38,3 +38,5 @@ export const allocate',
      oldStart: 38,
      oldLines: 3,
      newStart: 38,
      newLines: 5,
      lines: [
        { kind: 'context', oldLine: 38, newLine: 38, text: 'export const allocate = () => {' },
        { kind: 'del', oldLine: 39, newLine: null, text: '  return raw.map(Math.round);' },
        { kind: 'add', oldLine: null, newLine: 39, text: '  const rounded = raw.map(floor);' },
        {
          kind: 'add',
          oldLine: null,
          newLine: 40,
          text: '  const residual = total - sum(rounded);',
        },
        { kind: 'add', oldLine: null, newLine: 41, text: '  return applyResidual(rounded);' },
        { kind: 'context', oldLine: 40, newLine: 42, text: '};' },
      ],
    },
  ],
};

const RELAY: FileDiff = {
  path: 'notify-relay/src/retry/skipSettled.ts',
  status: 'added',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [
    {
      header: '@@ -0,0 +1,1 @@',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'export const skip = true;' }],
    },
  ],
};

const thread = (overrides: Partial<DiffThread> = {}): DiffThread => ({
  id: 'n1',
  filePath: LEDGER.path,
  anchor: { side: 'new', lineNumber: 40 },
  body: 'Guard the residual when a weight is zero',
  tone: 'primary',
  author: 'You',
  isAgent: false,
  createdAt: '2026-09-25T10:00:00.000Z' as IsoDateTime,
  statusLabel: 'Open note',
  isResolved: false,
  canEdit: false,
  canResolve: true,
  canReopen: false,
  ...overrides,
});

const commentsWith = (threads: ReadonlyArray<DiffThread>): DiffComments => ({
  threads,
  submitLabel: 'Add note',
  composerLabel: 'Note',
  allowFileLevel: true,
  onSubmit: vi.fn(),
  onAskAgent: vi.fn(),
  onResolve: vi.fn(),
  onReopen: vi.fn(),
  onDelete: vi.fn(),
});

beforeEach(() => {
  localStorage.clear();
  (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn();
});
afterEach(cleanup);

const codeCells = () =>
  screen
    .getAllByRole('row')
    .filter((row) => row.getAttribute('data-line-kind') !== null)
    .map((row) => row.lastElementChild as HTMLElement);

describe('DiffView rendering', () => {
  it('draws rows as a grid, not a table', () => {
    render(<DiffView files={[LEDGER]} />);
    expect(document.querySelector('table')).toBeNull();
    expect(screen.getByRole('grid', { name: `Changes in ${LEDGER.path}` })).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(6);
  });

  it('wraps by default and remembers turning it off', () => {
    render(<DiffView files={[LEDGER]} />);
    expect(codeCells()[0]?.className).toContain('whitespace-pre-wrap');
    fireEvent.click(screen.getByRole('button', { name: /Wrap/ }));
    expect(codeCells()[0]?.className).toContain('whitespace-pre');
    expect(codeCells()[0]?.className).not.toContain('whitespace-pre-wrap');
    expect(localStorage.getItem('goodboy:diff-wrap')).toBe('0');
  });

  it('pairs old and new lines side by side in split view', () => {
    render(<DiffView files={[LEDGER]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Split' }));
    const grid = screen.getByRole('grid');
    expect(grid.innerHTML).toContain('grid-cols-[44px_minmax(0,1fr)_44px_minmax(0,1fr)]');
    expect(screen.getByRole('button', { name: /Wrap/ }).hasAttribute('disabled')).toBe(true);
  });

  it('counts viewed files and collapses a file once viewed', () => {
    const viewed = new Set<string>();
    const onToggle = vi.fn((file: FileDiff, next: boolean) => {
      if (next) {
        viewed.add(file.path);
      }
    });
    const { rerender } = render(
      <DiffView
        files={[LEDGER, RELAY]}
        viewed={{ stateOf: (file) => (viewed.has(file.path) ? 'viewed' : 'none'), onToggle }}
      />,
    );
    expect(screen.getByText('0 of 2 viewed')).toBeTruthy();
    const header = screen.getByRole('region', { name: RELAY.path });
    fireEvent.click(within(header).getByRole('checkbox', { name: /Viewed/ }));
    expect(onToggle).toHaveBeenCalledWith(RELAY, true);
    rerender(
      <DiffView
        files={[LEDGER, RELAY]}
        viewed={{ stateOf: (file) => (viewed.has(file.path) ? 'viewed' : 'none'), onToggle }}
      />,
    );
    expect(screen.getByText('1 of 2 viewed')).toBeTruthy();
    expect(within(header).queryByRole('grid')).toBeNull();
  });

  it('keeps generated files collapsed until asked', () => {
    const lock: FileDiff = { ...RELAY, path: 'pnpm-lock.yaml' };
    render(<DiffView files={[lock]} />);
    expect(screen.queryByRole('grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show file' }));
    expect(screen.getByRole('grid')).toBeTruthy();
  });
});

describe('DiffView comments', () => {
  it('opens the composer on a line number and submits with cmd+enter', () => {
    const comments = commentsWith([]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    const gutter = screen.getByRole('button', { name: 'Comment on new line 39' });
    fireEvent.pointerDown(gutter, { button: 0 });
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    const box = screen.getByRole('textbox', { name: 'Note on line 39' });
    fireEvent.change(box, { target: { value: 'Name this floorToCents' } });
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true });
    expect(comments.onSubmit).toHaveBeenCalledWith(
      LEDGER.path,
      { side: 'new', lineNumber: 39 },
      'Name this floorToCents',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('selects a range by dragging across line numbers', () => {
    const comments = commentsWith([]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Comment on new line 39' }), {
      button: 0,
    });
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Comment on new line 41' }));
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    const box = screen.getByRole('textbox', { name: 'Note on lines 39 to 41' });
    fireEvent.change(box, { target: { value: 'Early return hides the zero weight path' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(comments.onSubmit).toHaveBeenCalledWith(
      LEDGER.path,
      { side: 'new', lineNumber: 39, endLineNumber: 41 },
      'Early return hides the zero weight path',
    );
  });

  it('extends the selection with shift-click', () => {
    render(<DiffView files={[LEDGER]} comments={commentsWith([])} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on new line 39' }), {
      key: 'Enter',
    });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Comment on new line 42' }), {
      button: 0,
      shiftKey: true,
    });
    expect(screen.getByRole('textbox', { name: 'Note on lines 39 to 42' })).toBeTruthy();
  });

  it('cancels the composer with escape', () => {
    render(<DiffView files={[LEDGER]} comments={commentsWith([])} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on new line 39' }), {
      key: 'Enter',
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('asks the agent with the selected lines', () => {
    const comments = commentsWith([]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on new line 40' }), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask agent' }));
    expect(comments.onAskAgent).toHaveBeenCalledWith({
      filePath: LEDGER.path,
      anchor: { side: 'new', lineNumber: 40 },
      text: '  const residual = total - sum(rounded);',
    });
  });

  it('shows a thread under its line and resolves it', () => {
    const comments = commentsWith([thread()]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    expect(screen.getByText('Guard the residual when a weight is zero')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(comments.onResolve).toHaveBeenCalledWith('n1');
  });

  it('collapses a resolved thread to one line with reopen', () => {
    const comments = commentsWith([
      thread({ isResolved: true, statusLabel: 'Resolved', canResolve: false, canReopen: true }),
    ]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    const resolved = document.querySelector('[data-thread-state="resolved"]');
    expect(resolved?.textContent).toContain('Resolved');
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(comments.onReopen).toHaveBeenCalledWith('n1');
  });

  it('asks before deleting a thread', () => {
    const comments = commentsWith([thread()]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(comments.onDelete).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole('button', { name: 'Delete' }).at(-1);
    fireEvent.click(confirm as HTMLElement);
    expect(comments.onDelete).toHaveBeenCalledWith('n1');
  });
});

describe('DiffView navigation', () => {
  it('opens the file jump with T and filters files', () => {
    render(<DiffView files={[LEDGER, RELAY]} />);
    fireEvent.keyDown(window, { code: 'KeyT', key: 't' });
    const filter = screen.getByRole('combobox', { name: 'Filter files' });
    fireEvent.change(filter, { target: { value: 'skip' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('skipSettled.ts');
    fireEvent.keyDown(filter, { key: 'Enter' });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('moves between files with [ and ]', () => {
    render(<DiffView files={[LEDGER, RELAY]} />);
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scroll.mockClear();
    fireEvent.keyDown(window, { code: 'BracketRight', key: ']' });
    expect(scroll).toHaveBeenCalledTimes(1);
    expect((scroll.mock.contexts[0] as HTMLElement).getAttribute('data-file-path')).toBe(
      RELAY.path,
    );
    fireEvent.keyDown(window, { code: 'BracketLeft', key: '[' });
    expect((scroll.mock.contexts[1] as HTMLElement).getAttribute('data-file-path')).toBe(
      LEDGER.path,
    );
  });

  it('ignores shortcuts while typing', () => {
    render(<DiffView files={[LEDGER]} comments={commentsWith([])} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on new line 39' }), {
      key: 'Enter',
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { code: 'KeyT', key: 't' });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('keeps the peek free of the toolbar and shortcuts', () => {
    render(<DiffView files={[LEDGER]} presentation="peek" />);
    expect(screen.queryByRole('button', { name: /files/ })).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyT', key: 't' });
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
