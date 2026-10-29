// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FileDiff, MountId, SessionId } from '@goodboy/types';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { SessionDiff } from '../../hooks/useSessionDiff';

const h = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  scroll: vi.fn(),
}));

const SESSION_ID = 'session-1' as SessionId;
const MOUNT = {
  mountId: 'mount-ledger' as MountId,
  projectId: 'project-ledger',
  mountName: 'ledger-core',
  branch: 'fix/ledger-reconcile-postings',
  worktreePath: '/w/ledger',
  repoRoot: '/repo/ledger',
  baseBranch: null,
};

const baseStore = () => ({
  settings: {},
  projects: [{ id: 'project-ledger', kind: 'repo', baseBranch: 'main', rootPath: '/repo/ledger' }],
  sessions: [],
  emitNotification: vi.fn(),
  navigate: vi.fn(),
  reviewDrafts: {},
  loadReviewDrafts: vi.fn(),
  addReviewDraft: vi.fn(),
  updateReviewDraft: vi.fn(),
  discardReviewDraft: vi.fn(),
  reportError: vi.fn(),
  branchFilesFolder: {},
  setBranchFilesFolder: vi.fn(),
});

vi.mock('../../../../store/slices/review-drafts/resolveReviewTarget', () => ({
  resolveReviewTarget: () => h.store['reviewTarget'] ?? null,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(
    <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.store),
    { getState: () => h.store, subscribe: () => () => undefined },
  ),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../store/slices/project-mounts/selectors')>()),
  selectMountForPath: () => MOUNT,
  selectMountBaseBranch: () => h.store['baseBranch'] ?? null,
}));

vi.mock('../../hooks/useDiffReviewThreads', () => ({
  useDiffReviewThreads: () => ({
    threads: [],
    onReply: vi.fn(),
    onResolve: vi.fn(),
    onOpenInComments: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiffNotes', () => ({
  useDiffNotes: () => ({ threads: [], allowFileLevel: h.store['allowFileLevel'] === true }),
}));

vi.mock('../DiffViewSelector', () => ({
  DiffViewSelector: ({ baseBranch }: { readonly baseBranch: string | null }) => (
    <button type="button">Compared with {baseBranch ?? 'its base branch'}</button>
  ),
}));

vi.mock('../DiffView', async () => {
  const { useEffect } = await import('react');
  return {
    DiffView: ({
      files,
      toolbarStart,
      toolbarEnd,
      registerScroller,
    }: {
      readonly files: ReadonlyArray<FileDiff>;
      readonly toolbarStart?: ReactNode;
      readonly toolbarEnd?: ReactNode;
      readonly registerScroller?: (scroll: ((path: string) => void) | null) => void;
    }) => {
      useEffect(() => {
        registerScroller?.(h.scroll);
        return () => registerScroller?.(null);
      }, [registerScroller]);
      return (
        <div data-testid="diff-view" data-files={files.map((file) => file.path).join(',')}>
          <div data-testid="diff-toolbar">
            {toolbarStart}
            {toolbarEnd}
          </div>
        </div>
      );
    },
  };
});

import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { SessionDiffPane } from './index';

const diffOf = (files: ReadonlyArray<FileDiff> = []): SessionDiff => ({
  files,
  patch: '',
  loading: false,
  isRefreshing: false,
  error: null,
  view: { kind: 'branch' },
  setView: vi.fn(),
  alternate: null,
  commits: [],
  status: null,
  metaError: null,
  refresh: vi.fn(),
  viewed: { stateOf: () => 'none', onToggle: vi.fn() },
  focusPath: null,
  focusThreadId: null,
  clearFocus: vi.fn(),
});

const FILE: FileDiff = {
  path: 'src/ledger/postings.ts',
  status: 'modified',
  additions: 3,
  deletions: 1,
  binary: false,
  hunks: [],
};

const renderPane = ({
  diff = diffOf(),
  isReadOnly = false,
  pageWidth = null,
}: {
  readonly diff?: SessionDiff;
  readonly isReadOnly?: boolean;
  readonly pageWidth?: number | null;
}) => {
  const observers = pageWidth === null ? null : installFakeResizeObserver();
  if (pageWidth !== null) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, pageWidth, 800),
    );
  }
  const view = render(
    <SessionDiffPane
      sessionId={SESSION_ID}
      workingDir="/w/ledger"
      worktreePath={MOUNT.worktreePath}
      diff={diff}
      isReadOnly={isReadOnly}
      toolbarEnd={<button type="button">Fix comments 2</button>}
    />,
  );
  if (observers !== null) {
    act(() => observers.resizeAll());
  }
  return view;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  h.store = baseStore();
});

h.store = baseStore();

describe('SessionDiffPane empty state', () => {
  it('names the base branch the branch matches', () => {
    h.store = { ...baseStore(), baseBranch: 'develop' };
    renderPane({});

    expect(screen.getByText('Branch matches develop')).toBeDefined();
    expect(screen.getByText(/already reachable from develop/)).toBeDefined();
  });

  it('never says main when no base branch is known', () => {
    renderPane({});

    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
    expect(screen.getByText(/already reachable from its base branch/)).toBeDefined();
  });
});

describe('SessionDiffPane states', () => {
  it('shows skeleton rows in the tree column while the diff loads', () => {
    renderPane({ diff: { ...diffOf(), loading: true } });

    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    expect(within(tree).getByText('Loading files…')).toBeDefined();
    expect(within(tree).getByRole('status', { name: 'Loading files' })).toBeDefined();
  });

  it('replaces the tree and diff chrome with one empty state when nothing changed', () => {
    renderPane({});

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(screen.queryByText('0 files')).toBeNull();
    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Compared with/ })).toHaveLength(1);
  });
});

describe('SessionDiffPane empty working tree', () => {
  const cleanWorking = (alternate: SessionDiff['alternate'] = null): SessionDiff => ({
    ...diffOf(),
    view: { kind: 'working', scope: 'all' },
    alternate,
  });

  it('says what is empty with the picker inline when the branch has nothing either', () => {
    renderPane({ diff: cleanWorking() });

    expect(screen.getByText('No changes on this branch yet')).toBeDefined();
    expect(screen.getByRole('button', { name: /Compared with/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Show branch vs/ })).toBeNull();
  });

  it('offers the branch scope with its file count when the working tree is clean', () => {
    h.store = { ...baseStore(), baseBranch: 'main' };
    const setView = vi.fn();
    const alternate = { view: { kind: 'branch' } as const, fileCount: 6 };
    renderPane({ diff: { ...cleanWorking(alternate), setView } });

    expect(screen.getByText('Working tree clean')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show branch vs main (6 files)' }));

    expect(setView).toHaveBeenCalledWith({ kind: 'branch' });
  });

  it('offers the working tree when the branch matches its base but has edits', () => {
    h.store = { ...baseStore(), baseBranch: 'main' };
    const setView = vi.fn();
    const alternate = { view: { kind: 'working', scope: 'all' } as const, fileCount: 1 };
    renderPane({ diff: { ...diffOf(), alternate, setView } });

    fireEvent.click(screen.getByRole('button', { name: 'Show working tree (1 file)' }));

    expect(setView).toHaveBeenCalledWith({ kind: 'working', scope: 'all' });
  });
});

const FILES: ReadonlyArray<FileDiff> = [FILE, { ...FILE, path: 'src/ledger/export.ts' }];

const treeOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Changed files' });

const railOf = (): HTMLElement => screen.getByRole('complementary', { name: 'Files' });

const toolbarFiles = (): HTMLElement | null =>
  within(screen.getByTestId('diff-toolbar')).queryByRole('button', { name: /^Files/ });

const FOLDED_KEY = 'goodboy:diff-file-rail-folded:v1';
const WIDTH_KEY = 'goodboy:diff-file-rail-width:v1';

describe('SessionDiffPane with the file rail docked on the right', () => {
  it('draws the tree, the filter and Next unviewed in the rail, never in the diff column', () => {
    renderPane({ diff: diffOf(FILES) });

    expect(railOf().getAttribute('data-file-rail')).toBe('docked');
    expect(railOf().contains(treeOf())).toBe(true);
    expect(within(railOf()).getByRole('searchbox', { name: 'Filter files' })).toBeDefined();
    expect(within(railOf()).getByRole('button', { name: 'Filter and group files' })).toBeDefined();
    expect(within(railOf()).getByRole('button', { name: /^Next unviewed/ })).toBeDefined();
    expect(screen.getByTestId('diff-view').contains(treeOf())).toBe(false);
  });

  it('puts Next unviewed, the keys and Fold in the rail head, above the filter', () => {
    renderPane({ diff: diffOf(FILES) });

    const buttons = within(railOf())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(buttons.slice(0, 3)).toEqual([
      'Next unviewed2',
      'Keyboard shortcuts',
      'Fold the file list',
    ]);
    expect(within(railOf()).getByRole('separator', { name: 'Resize the file list' })).toBeDefined();
    expect(toolbarFiles()).toBeNull();
  });

  it('keeps the tree after a pick, and Escape does not hide it', () => {
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(within(treeOf()).getByRole('button', { name: /^export\.ts/ }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(treeOf()).toBeDefined();
  });

  it('puts focus in the tree with the focus key', () => {
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
  });

  it('focuses the filter with the slash and with T', () => {
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusFilter' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter files' }));
    (document.activeElement as HTMLElement).blur();

    pressShortcut({ id: 'diff.focusFilterAlias' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter files' }));
  });

  it('counts the unviewed files on the filter and the rail head, from the whole review', () => {
    const diff = {
      ...diffOf(FILES),
      viewed: {
        stateOf: (file: FileDiff) =>
          file.path === FILE.path ? ('viewed' as const) : ('none' as const),
        onToggle: vi.fn(),
      },
    };
    renderPane({ diff });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter files' }), {
      target: { value: 'postings' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filter and group files' }));
    expect(screen.getByRole('menuitemradio', { name: /^Unviewed/ }).textContent).toContain('1');
    expect(screen.getByRole('button', { name: /^Next unviewed/ }).textContent).toContain('1');
  });

  it('jumps to the next unviewed file from the rail head and keeps the rail in place', () => {
    const diff = {
      ...diffOf(FILES),
      viewed: {
        stateOf: (file: FileDiff) =>
          file.path === FILE.path ? ('viewed' as const) : ('none' as const),
        onToggle: vi.fn(),
      },
    };
    renderPane({ diff });

    fireEvent.click(screen.getByRole('button', { name: /^Next unviewed/ }));

    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(treeOf()).toBeDefined();
  });

  it('shows the same empty state, with no rail and no Files button, when nothing changed', () => {
    renderPane({});

    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Files/ })).toBeNull();
  });
});

describe('SessionDiffPane with the file rail folded', () => {
  it('folds the rail, remembers it and opens it again from Files N in the toolbar', () => {
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(within(railOf()).getByRole('button', { name: 'Fold the file list' }));

    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
    expect(localStorage.getItem(FOLDED_KEY)).toBe('1');
    expect(toolbarFiles()?.textContent).toBe('Files');

    cleanup();
    renderPane({ diff: diffOf(FILES) });
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();

    const files = toolbarFiles();
    if (files === null) {
      throw new Error('the folded rail leaves no Files button');
    }
    fireEvent.click(files);

    expect(railOf().getAttribute('data-file-rail')).toBe('docked');
    expect(treeOf().contains(document.activeElement)).toBe(true);
    expect(localStorage.getItem(FOLDED_KEY)).toBe('0');
    expect(toolbarFiles()).toBeNull();
  });

  it('opens a folded rail with the focus key and puts focus in the tree', () => {
    localStorage.setItem(FOLDED_KEY, '1');
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
    expect(localStorage.getItem(FOLDED_KEY)).toBe('0');
  });

  it('keeps j and k walking the diff while the rail is folded', () => {
    localStorage.setItem(FOLDED_KEY, '1');
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.fileDown' });

    expect(h.scroll).toHaveBeenCalled();
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
  });

  it('remembers the width the handle gives it', () => {
    renderPane({ diff: diffOf(FILES) });

    const handle = within(railOf()).getByRole('separator', { name: 'Resize the file list' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(localStorage.getItem(WIDTH_KEY)).toBe('328');
    cleanup();
    renderPane({ diff: diffOf(FILES) });
    expect(
      within(railOf())
        .getByRole('separator', { name: 'Resize the file list' })
        .getAttribute('aria-valuenow'),
    ).toBe('328');
  });
});

describe('SessionDiffPane on a page too narrow to dock the rail', () => {
  it('draws no rail and offers Files N in the toolbar', () => {
    renderPane({ diff: diffOf(FILES), pageWidth: 700 });

    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
    expect(toolbarFiles()).not.toBeNull();
  });

  it('opens the rail over the diff with the focus key and closes it on a pick', () => {
    renderPane({ diff: diffOf(FILES), pageWidth: 700 });

    pressShortcut({ id: 'diff.focusTree' });

    expect(railOf().getAttribute('data-file-rail')).toBe('overlay');
    expect(treeOf().contains(document.activeElement)).toBe(true);
    fireEvent.click(within(treeOf()).getByRole('button', { name: /^export\.ts/ }));
    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
  });

  it('opens it into the filter with the slash, Fold closes it, Files N opens it into the tree and Esc closes it', () => {
    renderPane({ diff: diffOf(FILES), pageWidth: 700 });

    pressShortcut({ id: 'diff.focusFilter' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter files' }));

    fireEvent.click(within(railOf()).getByRole('button', { name: 'Fold the file list' }));
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();

    const files = toolbarFiles();
    if (files === null) {
      throw new Error('the narrow page leaves no Files button');
    }
    fireEvent.click(files);
    expect(railOf().getAttribute('data-file-rail')).toBe('overlay');
    expect(treeOf().contains(document.activeElement)).toBe(true);
    expect(localStorage.getItem(FOLDED_KEY)).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
  });
});

describe('SessionDiffPane files', () => {
  it('puts the comparison on the one line above the code, with the real base and no counts', () => {
    h.store = { ...baseStore(), baseBranch: 'develop' };
    const diff = {
      ...diffOf([FILE]),
      status: { branch: 'feat/ledger-export' } as SessionDiff['status'],
    };
    renderPane({ diff });

    const toolbar = screen.getByTestId('diff-toolbar');
    expect(within(toolbar).getByRole('button', { name: 'Compared with develop' })).toBeDefined();
    expect(screen.queryByText('1 file')).toBeNull();
    expect(within(toolbar).queryByText('+3')).toBeNull();
  });

  it('keeps the comparison line when there is nothing to draw under it', () => {
    renderPane({});

    expect(screen.getByRole('button', { name: /Compared with/ })).toBeDefined();
    expect(screen.queryByTestId('diff-view')).toBeNull();
  });

  it('lists the changed files in a tree in the rail beside the code', () => {
    renderPane({ diff: diffOf([FILE]) });

    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    expect(within(tree).getByRole('treeitem', { name: /postings\.ts/ })).toBeDefined();
    expect(within(tree).getByRole('button', { name: /^Next unviewed/ })).toBeDefined();
  });

  it('filters the tree and the diff together, then restores both on Clear', () => {
    const other: FileDiff = { ...FILE, path: 'src/ledger/export.ts' };
    renderPane({ diff: diffOf([FILE, other]) });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter files' }), {
      target: { value: 'export' },
    });

    expect(screen.getByText('Showing 1 of 2')).toBeDefined();
    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe('src/ledger/export.ts');
    expect(screen.queryByRole('treeitem', { name: /postings\.ts/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe(
      'src/ledger/export.ts,src/ledger/postings.ts',
    );
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('keeps only unviewed files when Unviewed is on', () => {
    const other: FileDiff = { ...FILE, path: 'src/ledger/export.ts' };
    const diff = {
      ...diffOf([FILE, other]),
      viewed: {
        stateOf: (file: FileDiff) =>
          file.path === FILE.path ? ('viewed' as const) : ('none' as const),
        onToggle: vi.fn(),
      },
    };
    renderPane({ diff });

    fireEvent.click(screen.getByRole('button', { name: 'Filter and group files' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Unviewed/ }));

    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe('src/ledger/export.ts');
    expect(screen.getByText('Showing 1 of 2')).toBeDefined();
  });

  it('says no file matches and offers Clear in the diff when the filter hides everything', () => {
    renderPane({ diff: diffOf([FILE]) });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter files' }), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('No files match')).toBeDefined();
    expect(screen.queryByTestId('diff-view')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Clear' })).toHaveLength(3);
  });

  it('ends the toolbar with the entry it is given and carries no Write review', () => {
    renderPane({ diff: diffOf([FILE]) });

    const toolbar = screen.getByTestId('diff-toolbar');
    expect(within(toolbar).getByRole('button', { name: 'Fix comments 2' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Write review' })).toBeNull();
  });

  it('carries no Push, Rewrite, PR or Open in Review control of its own', () => {
    renderPane({ diff: diffOf([FILE]) });

    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /Push|Rewrite|PR #|Open in Review/.test(name))).toEqual([]);
  });

  it('draws no viewed toggle in the rail of a merged or closed pull request', () => {
    renderPane({ diff: diffOf([FILE]), isReadOnly: true });

    expect(screen.queryByRole('button', { name: /^Viewed:/ })).toBeNull();
  });
});
