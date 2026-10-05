// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FileDiff, IsoDateTime } from '@goodboy/types';
import { DiffView } from '.';
import type { DiffComments, DiffThread } from './types';

const { fileRenders } = vi.hoisted(() => ({ fileRenders: { current: 0 } }));

vi.mock('../../hooks/useDiffTokens', () => ({
  useDiffTokens: () => {
    fileRenders.current += 1;
    return null;
  },
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
  canClose: true,
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
  onClose: vi.fn(),
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
    screen.getByRole('grid', { name: `Changes in ${LEDGER.path}` });
    expect(screen.getAllByRole('row').length).toBeGreaterThan(6);
  });

  it('wraps by default and remembers turning it off', () => {
    render(<DiffView files={[LEDGER]} />);
    expect(codeCells()[0]?.className).toContain('whitespace-pre-wrap');
    fireEvent.click(screen.getByRole('button', { name: /Display/ }));
    expect(screen.getByRole('switch', { name: /Wrap/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: /Wrap/ }));
    expect(screen.getByRole('switch', { name: /Wrap/ }).getAttribute('aria-checked')).toBe('false');
    expect(codeCells()[0]?.className).toContain('whitespace-pre');
    expect(codeCells()[0]?.className).not.toContain('whitespace-pre-wrap');
    expect(localStorage.getItem('goodboy:diff-wrap')).toBe('0');
  });

  it('pairs old and new lines side by side in split view', () => {
    render(<DiffView files={[LEDGER]} />);
    fireEvent.click(screen.getByRole('button', { name: /Display/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Split' }));
    const grid = screen.getByRole('grid');
    expect(grid.innerHTML).toContain('grid-cols-[44px_minmax(0,1fr)_44px_minmax(0,1fr)]');
    expect(screen.getByRole('switch', { name: /Wrap/ }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps layout and wrap in one Display menu and the toolbar on one line', () => {
    render(
      <DiffView
        files={[LEDGER]}
        toolbarStart={<span>Comparing main ← feat/ledger-export</span>}
        toolbarEnd={<button type="button">Write review</button>}
      />,
    );

    expect(screen.queryByRole('tab', { name: 'Split' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    const toolbar = document.querySelector('[data-slot="diff-toolbar"]') as HTMLElement;
    expect(within(toolbar).getByText('Comparing main ← feat/ledger-export')).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Display/ })).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: 'Write review' })).toBeDefined();
  });

  it('collapses a file once viewed', () => {
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
    const header = screen.getByRole('region', { name: RELAY.path });
    fireEvent.click(within(header).getByRole('checkbox', { name: /Viewed/ }));
    expect(onToggle).toHaveBeenCalledWith(RELAY, true);
    rerender(
      <DiffView
        files={[LEDGER, RELAY]}
        viewed={{ stateOf: (file) => (viewed.has(file.path) ? 'viewed' : 'none'), onToggle }}
      />,
    );
    expect(within(header).queryByRole('grid')).toBeNull();
  });

  it('follows a Viewed set from outside: closes the file, and opens it again when unset', () => {
    const stateOf = (path: string | null) => (file: FileDiff) =>
      file.path === path ? ('viewed' as const) : ('none' as const);
    const viewedFor = (path: string | null) => ({ stateOf: stateOf(path), onToggle: vi.fn() });
    const { rerender } = render(<DiffView files={[LEDGER, RELAY]} viewed={viewedFor(null)} />);
    const header = screen.getByRole('region', { name: RELAY.path });
    expect(within(header).queryByRole('grid')).not.toBeNull();

    rerender(<DiffView files={[LEDGER, RELAY]} viewed={viewedFor(RELAY.path)} />);
    expect(within(header).queryByRole('grid')).toBeNull();

    rerender(<DiffView files={[LEDGER, RELAY]} viewed={viewedFor(null)} />);
    expect(within(header).queryByRole('grid')).not.toBeNull();
  });

  it('keeps generated files collapsed until asked', () => {
    const lock: FileDiff = { ...RELAY, path: 'pnpm-lock.yaml' };
    render(<DiffView files={[lock]} />);
    expect(screen.queryByRole('grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show file' }));
    screen.getByRole('grid');
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
    screen.getByRole('textbox', { name: 'Note on lines 39 to 42' });
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

  it('hands the agent the note typed in the composer along with the lines', () => {
    const comments = commentsWith([]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on new line 40' }), {
      key: 'Enter',
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Note on line 40' }), {
      target: { value: '  Rebuild this from the intro question.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask agent' }));
    expect(comments.onAskAgent).toHaveBeenCalledWith({
      filePath: LEDGER.path,
      anchor: { side: 'new', lineNumber: 40 },
      text: '  const residual = total - sum(rounded);',
      note: 'Rebuild this from the intro question.',
    });
    expect(comments.onSubmit).not.toHaveBeenCalled();
  });

  it('shows a note under its line with Fix and Close note, and no control says Resolve', () => {
    const onFix = vi.fn();
    const comments = commentsWith([
      thread({ actions: [{ id: 'fix', label: 'Fix', isPrimary: true, onClick: onFix }] }),
    ]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    screen.getByText('Guard the residual when a weight is zero');
    fireEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(onFix).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Close note' }));
    expect(comments.onClose).toHaveBeenCalledWith('n1');
    expect(screen.queryAllByRole('button', { name: /^Resolve/ })).toEqual([]);
  });

  it('blocks Close note and Delete on a note a fixer is working on, and says why', () => {
    const reason = 'A fixer is working on this note';
    const comments = commentsWith([thread({ lockReason: reason, meta: 'Sonnet 5.5 · Medium' })]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    const close = screen.getByRole('button', { name: 'Close note' });
    expect(close.hasAttribute('disabled')).toBe(true);
    expect(close.getAttribute('title')).toBe(reason);
    expect(screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled')).toBe(true);
    screen.getByText(reason);
  });

  it('collapses a resolved thread to one line with reopen', () => {
    const comments = commentsWith([
      thread({ isResolved: true, statusLabel: 'Closed', canClose: false, canReopen: true }),
    ]);
    render(<DiffView files={[LEDGER]} comments={comments} />);
    const resolved = document.querySelector('[data-thread-state="resolved"]');
    expect(resolved?.textContent).toContain('Closed');
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
  it('reports the file it lands on', async () => {
    const onActivePathChange = vi.fn();
    const { rerender } = render(
      <DiffView files={[LEDGER, RELAY]} onActivePathChange={onActivePathChange} />,
    );
    rerender(
      <DiffView
        files={[LEDGER, RELAY]}
        onActivePathChange={onActivePathChange}
        focusPath={RELAY.path}
      />,
    );
    await waitFor(() => expect(onActivePathChange).toHaveBeenCalledWith(RELAY.path));
  });

  describe('landing with estimated heights', () => {
    const PLACEHOLDER = 480;
    const VIEWPORT = 600;
    const MANY = Array.from({ length: 30 }, (_, index): FileDiff => ({
      ...RELAY,
      path: `ledger-core/src/f${String(index).padStart(2, '0')}.ts`,
    }));
    const realHeight = (index: number) => 120 + ((index * 337) % 1100);
    let scrollTop = 0;
    let painted = new Set<number>();
    const indexOf = (element: Element) =>
      MANY.findIndex((entry) => entry.path === element.getAttribute('data-file-path'));
    const heightOf = (index: number) => (painted.has(index) ? realHeight(index) : PLACEHOLDER);
    const offsetOf = (index: number) =>
      Array.from({ length: index }, (_, k) => heightOf(k)).reduce((sum, h) => sum + h, 0);
    const paint = (from: number, to: number) => {
      let top = 0;
      MANY.forEach((_, index) => {
        if (top < to + VIEWPORT && top + heightOf(index) > from) {
          painted.add(index);
        }
        top += heightOf(index);
      });
    };
    const headerTop = (path: string) =>
      document.querySelector(`[data-file-path="${path}"]`)?.getBoundingClientRect().top;

    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
      });
      scrollTop = 0;
      painted = new Set();
      paint(0, 0);
      (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn(
        function (this: Element) {
          const index = indexOf(this);
          if (index < 0) {
            return;
          }
          const from = scrollTop;
          const target = offsetOf(index);
          scrollTop = target;
          paint(Math.min(from, target), Math.max(from, target));
        },
      );
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const index = indexOf(this);
        const top = index < 0 ? 0 : offsetOf(index) - scrollTop;
        const height = index < 0 ? VIEWPORT : heightOf(index);
        return new DOMRect(0, top, 800, height);
      });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const pickIn = (view: ReturnType<typeof render>, index: number) => {
      view.rerender(<DiffView files={MANY} focusPath={MANY[index]?.path ?? null} />);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    };

    it('puts the picked file header at the top once the heights settle', () => {
      const view = render(<DiffView files={MANY} />);
      pickIn(view, 17);
      expect(headerTop(MANY[17]?.path ?? '')).toBe(0);
      pickIn(view, 25);
      expect(headerTop(MANY[25]?.path ?? '')).toBe(0);
      pickIn(view, 3);
      expect(headerTop(MANY[3]?.path ?? '')).toBe(0);
    });

    it('lands the next file header at the top after the picked one', () => {
      const view = render(<DiffView files={MANY} />);
      pickIn(view, 17);
      pickIn(view, 18);
      expect(headerTop(MANY[18]?.path ?? '')).toBe(0);
    });
  });

  it('keeps the peek free of the toolbar', () => {
    render(<DiffView files={[LEDGER, RELAY]} presentation="peek" />);
    expect(screen.queryByRole('button', { name: /Display/ })).toBeNull();
  });
});

describe('DiffView file-level comments', () => {
  const fileThread = (): DiffThread =>
    thread({ id: 'file-note', anchor: null, body: 'Split this file before it grows' });

  it('shows a visible Comment on file action on every file header', () => {
    render(<DiffView files={[LEDGER, RELAY]} comments={commentsWith([])} />);

    expect(screen.getAllByRole('button', { name: 'Comment on file' })).toHaveLength(2);
  });

  it('opens a composer under the header and saves the text against the file with no anchor', () => {
    const comments = commentsWith([]);
    render(<DiffView files={[LEDGER]} comments={comments} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comment on file' }));
    expect(screen.getByText('Note on this file')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Split this file' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    expect(comments.onSubmit).toHaveBeenCalledWith(LEDGER.path, null, 'Split this file');
  });

  it('uses the file composer wording when the comments carry one, such as a review draft', () => {
    render(
      <DiffView
        files={[LEDGER]}
        comments={{
          ...commentsWith([]),
          fileComposer: { label: 'Draft on this file', submitLabel: 'Add draft' },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Comment on file' }));

    expect(screen.getByText('Draft on this file')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add draft' })).toBeDefined();
  });

  it('opens the composer for a file the tree asked for, once, and says it was opened', () => {
    const onOpened = vi.fn();
    render(
      <DiffView
        files={[LEDGER, RELAY]}
        comments={commentsWith([])}
        fileCommentPath={RELAY.path}
        onFileCommentOpened={onOpened}
      />,
    );

    expect(onOpened).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Note on this file')).toHaveLength(1);
    const section = screen.getByRole('region', { name: RELAY.path });
    expect(within(section).getByText('Note on this file')).toBeDefined();
  });

  it('opens the composer on a collapsed file when the tree asks', () => {
    const viewed = {
      stateOf: (file: FileDiff) =>
        file.path === LEDGER.path ? ('viewed' as const) : ('none' as const),
      onToggle: vi.fn(),
    };
    render(
      <DiffView
        files={[LEDGER]}
        viewed={viewed}
        comments={commentsWith([])}
        fileCommentPath={LEDGER.path}
      />,
    );

    expect(screen.getByText('Note on this file')).toBeDefined();
  });

  it('shows a file-level note under the header and counts it in the header', () => {
    render(<DiffView files={[LEDGER]} comments={commentsWith([fileThread()])} />);

    const section = screen.getByRole('region', { name: LEDGER.path });
    expect(within(section).getByText('Split this file before it grows')).toBeDefined();
    expect(within(section).getByLabelText('1 comment')).toBeDefined();
  });

  it('has no Comment on file action when the comments do not allow file level', () => {
    render(<DiffView files={[LEDGER]} comments={{ ...commentsWith([]), allowFileLevel: false }} />);

    expect(screen.queryByRole('button', { name: 'Comment on file' })).toBeNull();
  });
});

describe('DiffView file renders', () => {
  it('leaves the file bodies alone when only the active file changes', async () => {
    const { rerender } = render(<DiffView files={[LEDGER, RELAY]} />);
    fileRenders.current = 0;

    rerender(<DiffView files={[LEDGER, RELAY]} focusPath={RELAY.path} />);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(fileRenders.current).toBe(0);
  });

  it('leaves the file bodies alone when the parent re-renders with the same props', () => {
    const comments = commentsWith([thread()]);
    const { rerender } = render(<DiffView files={[LEDGER, RELAY]} comments={comments} />);
    fileRenders.current = 0;

    rerender(<DiffView files={[LEDGER, RELAY]} comments={comments} footer={<p>Footer</p>} />);

    screen.getByText('Footer');
    expect(fileRenders.current).toBe(0);
  });
});

describe('DiffView window', () => {
  const FILE_COUNT = 100;
  const sectionOf = (path: string) => document.querySelector(`[data-file-path="${path}"]`);
  const sections = () => Array.from(document.querySelectorAll('[data-file-path]'));
  const many = (count: number, folder = 'f'): ReadonlyArray<FileDiff> =>
    Array.from({ length: count }, (_, index) => ({
      ...RELAY,
      path: `ledger-core/src/${folder}${String(index).padStart(3, '0')}.ts`,
    }));
  const mountAll = async (files: ReadonlyArray<FileDiff>) => {
    const view = render(<DiffView files={files} />);
    await waitFor(() => expect(sections()).toHaveLength(files.length), { timeout: 5000 });
    return view;
  };
  const recordScrolls = () => {
    const calls: Array<string | null> = [];
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: function (this: Element) {
        calls.push(this.getAttribute('data-file-path'));
      },
    });
    return calls;
  };

  it('keeps every mounted file when the list is replaced by one with the same paths', async () => {
    const files = many(FILE_COUNT);
    const { rerender } = await mountAll(files);
    const before = sections();

    rerender(<DiffView files={files.map((file) => ({ ...file }))} />);

    expect(sections()).toHaveLength(FILE_COUNT);
    expect(sections().every((node, index) => node === before[index])).toBe(true);
  });

  it('starts over at the first batch when the list of paths changes', async () => {
    const { rerender } = await mountAll(many(FILE_COUNT));

    rerender(<DiffView files={many(FILE_COUNT, 'g')} />);

    expect(sections()).toHaveLength(20);
    expect(screen.getByText('20 of 100 files')).toBeDefined();
  });

  it('scrolls to a file through the registered scroller, mounting its batch first', async () => {
    const files = many(FILE_COUNT);
    const target = files[70]?.path ?? '';
    const calls = recordScrolls();
    let scroll: ((path: string) => void) | null = null;
    render(
      <DiffView
        files={files}
        registerScroller={(next) => {
          scroll = next;
        }}
      />,
    );
    expect(scroll).not.toBeNull();

    act(() => scroll?.(target));

    await waitFor(() => expect(calls).toContain(target));
    expect(sectionOf(target)).not.toBeNull();
  });

  it('forgets the scroller when it unmounts', () => {
    const register = vi.fn();
    const { unmount } = render(<DiffView files={many(3)} registerScroller={register} />);

    unmount();

    expect(register).toHaveBeenLastCalledWith(null);
  });

  it('still scrolls to the focus path when the parent clears it at once', async () => {
    const files = many(40);
    const target = files[30]?.path ?? '';
    const calls = recordScrolls();
    const Host = () => {
      const [focus, setFocus] = useState<string | null>(target);
      return <DiffView files={files} focusPath={focus} onFocusHandled={() => setFocus(null)} />;
    };

    render(<Host />);

    await waitFor(() => expect(calls).toContain(target));
  });
});
