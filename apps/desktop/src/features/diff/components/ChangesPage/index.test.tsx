// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

vi.mock('../../hooks/useDiffReviewThreads', () => ({
  useDiffReviewThreads: () => ({
    threads: [],
    onReply: vi.fn(),
    onResolve: vi.fn(),
    onOpenInComments: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiffNotes', () => ({
  useDiffNotes: () => ({ threads: [], allowFileLevel: false }),
}));

vi.mock('./ChangesScopePill', () => ({
  ChangesScopePill: () => null,
}));

vi.mock('../DiffViewSelector', () => ({
  DiffViewSelector: ({ baseBranch }: { readonly baseBranch: string | null }) => (
    <button type="button">Compared with {baseBranch ?? 'its base branch'}</button>
  ),
}));

const scroll = vi.hoisted(() => ({ calls: new Array<string>() }));

vi.mock('../DiffView', async () => {
  const { useEffect } = await import('react');
  const { ToolbarRow } = await import('../DiffView/ToolbarRow');
  return {
    DiffView: ({
      files,
      toolbarStart,
      toolbarEnd,
      belowToolbar,
      registerScroller,
    }: {
      readonly files: ReadonlyArray<FileDiff>;
      readonly toolbarStart?: ReactNode;
      readonly toolbarEnd?: ReactNode;
      readonly belowToolbar?: ReactNode;
      readonly registerScroller?: (scroll: ((path: string) => void) | null) => void;
    }) => {
      useEffect(() => {
        registerScroller?.((path) => scroll.calls.push(path));
        return () => registerScroller?.(null);
      }, [registerScroller]);
      return (
        <div data-testid="diff-view" data-files={files.map((file) => file.path).join(',')}>
          <ToolbarRow start={toolbarStart} end={toolbarEnd} isRow />
          {belowToolbar}
        </div>
      );
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { studioRailFoldKey } from '@goodboy/ui';
import {
  brandId,
  type FileDiff,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { CHANGES_RAIL_SURFACE } from '../../changesRailSurface';
import type { FilesFact } from '../../filesFact';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { ChangesPage } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const WORKTREE = '/w/ledger';
const FOLD_KEY = studioRailFoldKey({ surface: CHANGES_RAIL_SURFACE });

const MOUNT: SessionProjectMount = {
  mountId: brandId<MountId>({ value: 'mount-ledger' }),
  sessionId: SESSION_ID,
  projectId: brandId<ProjectId>({ value: 'project-ledger' }),
  mountName: 'ledger-core',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repo/ledger',
  branch: 'fix/ledger-reconcile-postings',
  baseBranch: 'develop',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const FILE: FileDiff = {
  path: 'src/ledger/postings.ts',
  status: 'modified',
  additions: 3,
  deletions: 1,
  binary: false,
  hunks: [],
};

const OTHER: FileDiff = { ...FILE, path: 'src/ledger/export.ts' };

const FILES: ReadonlyArray<FileDiff> = [FILE, OTHER];

const diffOf = (files: ReadonlyArray<FileDiff> = []): SessionDiff => ({
  files,
  patch: '',
  loading: false,
  isRefreshing: false,
  bodies: null,
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

const withFirstViewed = (files: ReadonlyArray<FileDiff>): SessionDiff => ({
  ...diffOf(files),
  viewed: {
    stateOf: (file: FileDiff) => (file.path === FILE.path ? 'viewed' : 'none'),
    onToggle: vi.fn(),
  },
});

type RenderParams = {
  readonly diff?: SessionDiff;
  readonly isReadOnly?: boolean;
  readonly pageWidth?: number | null;
  readonly filesFact?: FilesFact;
  readonly notice?: ReactNode;
};

let observers = installFakeResizeObserver();

const renderPage = ({
  diff = diffOf(),
  isReadOnly = false,
  pageWidth = null,
  filesFact,
  notice = null,
}: RenderParams) => {
  if (pageWidth !== null) {
    const rectOf = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-studio-rail')
        ? new DOMRect(0, 0, pageWidth, 800)
        : rectOf.call(this);
    });
  }
  const view = render(
    <ChangesPage
      sessionId={SESSION_ID}
      workingDir={WORKTREE}
      worktreePath={WORKTREE}
      diff={diff}
      isReadOnly={isReadOnly}
      filesFact={filesFact}
      notice={notice}
      toolbarEnd={<button type="button">Fix comments 2</button>}
    />,
  );
  if (pageWidth !== null) {
    act(() => observers.resizeAll());
  }
  return view;
};

const railOf = (): HTMLElement => screen.getByRole('complementary', { name: 'Files' });

const queryRail = (): HTMLElement | null => screen.queryByRole('complementary', { name: 'Files' });

const treeOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Changed files' });

const toolbarOf = (): HTMLElement => {
  const toolbar = document.querySelector<HTMLElement>('[data-slot="diff-toolbar"]');
  if (toolbar === null) {
    throw new Error('no diff toolbar');
  }
  return toolbar;
};

const filterField = (): HTMLElement => screen.getByRole('searchbox', { name: 'Search files' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  scroll.calls.length = 0;
  observers = installFakeResizeObserver();
  stubStoryInvoke({ detect_editors: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const seedMount = (): void => {
  useAppStore.setState((state) => ({
    sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION_ID]: [MOUNT] },
  }));
};

describe('ChangesPage empty states', () => {
  it('names the base branch the branch matches', () => {
    seedMount();
    renderPage({});

    screen.getByText('Branch matches develop');
    screen.getByText(/already reachable from develop/);
  });

  it('never says main when no base branch is known', () => {
    renderPage({});

    screen.getByText('Branch matches its base branch');
    screen.getByText(/already reachable from its base branch/);
  });

  it('keeps one comparison in the toolbar and draws no rail when nothing changed', () => {
    renderPage({});

    expect(queryRail()).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Compared with/ })).toHaveLength(1);
    expect(toolbarOf().contains(screen.getByRole('button', { name: /Compared with/ }))).toBe(true);
    expect(screen.queryByTestId('diff-view')).toBeNull();
  });

  it('offers the branch scope with its file count when the working tree is clean', () => {
    seedMount();
    const setView = vi.fn();
    const alternate = { view: { kind: 'branch' } as const, fileCount: 6 };
    renderPage({
      diff: { ...diffOf(), view: { kind: 'working', scope: 'all' }, alternate, setView },
    });

    screen.getByText('Working tree clean');
    fireEvent.click(screen.getByRole('button', { name: 'Show branch vs develop (6 files)' }));

    expect(setView).toHaveBeenCalledWith({ kind: 'branch' });
  });

  it('offers the working tree when the branch matches its base but has edits', () => {
    const setView = vi.fn();
    const alternate = { view: { kind: 'working', scope: 'all' } as const, fileCount: 1 };
    renderPage({ diff: { ...diffOf(), alternate, setView } });

    fireEvent.click(screen.getByRole('button', { name: 'Show working tree (1 file)' }));

    expect(setView).toHaveBeenCalledWith({ kind: 'working', scope: 'all' });
  });

  it('shows skeleton rows in the rail and in the diff column while the diff loads', () => {
    renderPage({ diff: { ...diffOf(), loading: true } });

    within(railOf()).getByRole('status', { name: 'Loading files' });
    screen.getByRole('status', { name: 'Loading the diff' });
  });
});

describe('ChangesPage as two columns', () => {
  it('puts the file rail on the left of the diff, in one row under the page header', () => {
    renderPage({ diff: diffOf(FILES) });

    const split = document.querySelector('[data-studio-rail="page"]');
    const columns = [...(split?.children ?? [])];
    expect(columns[0]).toBe(railOf());
    expect(columns[1]?.contains(screen.getByTestId('diff-view'))).toBe(true);
    expect(railOf().contains(treeOf())).toBe(true);
    expect(screen.getByTestId('diff-view').contains(treeOf())).toBe(false);
  });

  it('starts the rail and the diff with a first row of the same grid row', () => {
    renderPage({ diff: diffOf(FILES) });

    const railRow = railOf().querySelector('[data-grid-row="1"]');
    expect(railRow?.contains(screen.getByRole('tab', { name: /^Changed/ }))).toBe(true);
    expect(toolbarOf().getAttribute('data-grid-row')).toBe('1');
  });

  it('heads the rail with Changed N and All files, then the filter, then the tree', () => {
    renderPage({ diff: diffOf(FILES) });

    within(railOf()).getByRole('tab', { name: 'Changed 2' });
    within(railOf()).getByRole('tab', { name: 'All files' });
    within(railOf()).getByRole('button', { name: 'Filter and group files' });
    expect(railOf().contains(filterField())).toBe(true);
    expect(within(railOf()).queryByRole('button', { name: 'Next unviewed file' })).toBeNull();
  });

  it('ends the toolbar with Viewed N of M, Next, the keys and the entry it is given', () => {
    renderPage({ diff: withFirstViewed(FILES) });

    within(toolbarOf()).getByText('Viewed 1 of 2');
    const labels = within(toolbarOf())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(labels.slice(-3)).toEqual([
      'Next unviewed file',
      'Keyboard shortcuts',
      'Fix comments 2',
    ]);
  });

  it('jumps to the next unviewed file from Next and keeps the rail in place', () => {
    renderPage({ diff: withFirstViewed(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Next unviewed file' }));

    expect(scroll.calls).toContain('src/ledger/export.ts');
    expect(railOf().contains(treeOf())).toBe(true);
  });

  it('puts the setup notice in a row under the toolbar', () => {
    renderPage({ diff: diffOf(FILES), notice: <p>Worktree ledger-core is ready.</p> });

    const notice = screen.getByText('Worktree ledger-core is ready.');
    expect(toolbarOf().contains(notice)).toBe(false);
    expect(toolbarOf().compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('gives the rail and the toolbar the same total from the files fact', () => {
    const fact: FilesFact = { text: '2', diff: { additions: 6, deletions: 2 }, count: 2 };
    renderPage({ diff: diffOf(FILES), filesFact: fact });

    within(railOf()).getByRole('tab', { name: 'Changed 2' });
    expect(railOf().querySelector('[data-grid-row="1"]')?.textContent).toContain('+6');
    within(toolbarOf()).getByText('Viewed 0 of 2');
  });

  it('carries no Push, Rewrite, PR or Open in Review control of its own', () => {
    renderPage({ diff: diffOf([FILE]) });

    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /Push|Rewrite|PR #|Open in Review/.test(name))).toEqual([]);
  });

  it('draws no viewed toggle in the rail of a merged or closed pull request', () => {
    renderPage({ diff: diffOf([FILE]), isReadOnly: true });

    expect(screen.queryByRole('button', { name: /^Viewed:/ })).toBeNull();
  });
});

describe('ChangesPage selection and keys', () => {
  it('keeps the tree after a pick, and Escape does not hide it', () => {
    renderPage({ diff: diffOf(FILES) });

    fireEvent.click(within(treeOf()).getByRole('button', { name: /^export\.ts/ }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(scroll.calls).toContain('src/ledger/export.ts');
    expect(railOf().contains(treeOf())).toBe(true);
  });

  it('puts focus in the tree with the focus key', () => {
    renderPage({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
  });

  it('focuses the filter with the slash and with T', () => {
    renderPage({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusFilter' });
    expect(document.activeElement).toBe(filterField());
    filterField().blur();

    pressShortcut({ id: 'diff.focusFilterAlias' });
    expect(document.activeElement).toBe(filterField());
  });
});

describe('ChangesPage filter', () => {
  it('filters the tree and the diff together, then restores both on Clear', () => {
    renderPage({ diff: diffOf(FILES) });

    fireEvent.change(filterField(), { target: { value: 'export' } });

    screen.getByText('Showing 1 of 2');
    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe('src/ledger/export.ts');
    expect(screen.queryByRole('treeitem', { name: /postings\.ts/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe(
      'src/ledger/export.ts,src/ledger/postings.ts',
    );
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('keeps only unviewed files when Unviewed is on, counted from the whole review', () => {
    renderPage({ diff: withFirstViewed(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Filter and group files' }));
    const unviewed = screen.getByRole('menuitemradio', { name: /^Unviewed/ });
    expect(unviewed.textContent).toContain('1');
    fireEvent.click(unviewed);

    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe('src/ledger/export.ts');
    screen.getByText('Showing 1 of 2');
    within(toolbarOf()).getByText('Viewed 1 of 2');
  });

  it('says no file matches and offers Clear when the filter hides everything', () => {
    renderPage({ diff: diffOf([FILE]) });

    fireEvent.change(filterField(), { target: { value: 'zzz' } });

    screen.getByText('No files match');
    expect(screen.queryByTestId('diff-view')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Compared with/ })).toHaveLength(1);
  });
});

describe('ChangesPage rail fold', () => {
  it('folds the rail, remembers it and opens it again from Show files', () => {
    renderPage({ diff: diffOf(FILES) });

    fireEvent.click(within(railOf()).getByRole('button', { name: 'Hide files' }));

    expect(queryRail()).toBeNull();
    expect(localStorage.getItem(FOLD_KEY)).toBe('1');

    cleanup();
    renderPage({ diff: diffOf(FILES) });
    expect(queryRail()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show files' }));

    expect(railOf().contains(treeOf())).toBe(true);
    expect(localStorage.getItem(FOLD_KEY)).toBe('0');
  });

  it('opens a folded rail with the focus key and puts focus in the tree', () => {
    localStorage.setItem(FOLD_KEY, '1');
    renderPage({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
    expect(localStorage.getItem(FOLD_KEY)).toBe('0');
  });

  it('keeps j and k walking the diff while the rail is folded', () => {
    localStorage.setItem(FOLD_KEY, '1');
    renderPage({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.fileDown' });

    expect(scroll.calls.length).toBeGreaterThan(0);
    expect(queryRail()).toBeNull();
  });
});

describe('ChangesPage on a page too narrow for the rail', () => {
  it('folds the rail without writing the saved choice', () => {
    renderPage({ diff: diffOf(FILES), pageWidth: 700 });

    expect(queryRail()).toBeNull();
    screen.getByRole('button', { name: 'Show files' });
    expect(localStorage.getItem(FOLD_KEY)).toBeNull();
  });

  it('opens the framed rail over the page below 1060px, and Esc folds it again', () => {
    const host = document.createElement('div');
    const pane = document.createElement('div');
    document.body.append(host, pane);
    const rectOf = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this === pane ? new DOMRect(0, 0, 800, 800) : rectOf.call(this);
    });
    render(
      <ChangesPage
        sessionId={SESSION_ID}
        workingDir={WORKTREE}
        worktreePath={WORKTREE}
        diff={diffOf(FILES)}
        isReadOnly={false}
        railSlot={{ host, pane }}
      />,
    );
    act(() => observers.resizeAll());

    expect(queryRail()).toBeNull();
    fireEvent.click(within(host).getByRole('button', { name: 'Show files' }));

    expect(host.contains(railOf())).toBe(true);
    expect(railOf().dataset['railOverPage']).toBe('');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryRail()).toBeNull();
    within(host).getByRole('button', { name: 'Show files' });
    expect(localStorage.getItem(FOLD_KEY)).toBeNull();
    host.remove();
    pane.remove();
  });

  it('keeps the rail docked from 880px', () => {
    renderPage({ diff: diffOf(FILES), pageWidth: 880 });

    expect(railOf().contains(treeOf())).toBe(true);
  });

  it('opens the rail with the focus key and closes it on a pick', () => {
    renderPage({ diff: diffOf(FILES), pageWidth: 700 });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
    fireEvent.click(within(treeOf()).getByRole('button', { name: /^export\.ts/ }));
    expect(scroll.calls).toContain('src/ledger/export.ts');
    expect(queryRail()).toBeNull();
    expect(localStorage.getItem(FOLD_KEY)).toBeNull();
  });
});
