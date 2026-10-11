// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  useDiffReviewThreads: () => [],
}));

vi.mock('../../hooks/useDiffNotes', () => ({
  useDiffNotes: () => ({
    comments: { threads: [], allowFileLevel: h.store['allowFileLevel'] === true },
    fixes: [],
  }),
}));

vi.mock('../../../permissions/components/DiffViewSelector', () => ({
  DiffViewSelector: ({
    baseBranch,
    branch,
  }: {
    readonly baseBranch: string | null;
    readonly branch: string | null;
  }) => (
    <button type="button">
      Comparing {baseBranch ?? 'none'} ← {branch ?? 'none'}
    </button>
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

import { DiffRailHarness } from '../../../../__tests__/helpers/DiffRailHarness';
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
  onWriteReview = null,
  isOverlay = false,
}: {
  readonly diff?: SessionDiff;
  readonly onWriteReview?: (() => void) | null;
  readonly isOverlay?: boolean;
}) =>
  render(
    <DiffRailHarness isOverlay={isOverlay}>
      <SessionDiffPane
        sessionId={SESSION_ID}
        workingDir="/w/ledger"
        worktreePath={MOUNT.worktreePath}
        diff={diff}
        onWriteReview={onWriteReview}
      />
    </DiffRailHarness>,
  );

afterEach(() => {
  cleanup();
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
    expect(screen.getAllByRole('button', { name: /Comparing/ })).toHaveLength(1);
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
    expect(screen.getByRole('button', { name: /Comparing/ })).toBeDefined();
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

const hostOf = (): HTMLElement => screen.getByTestId('rail-host');

describe('SessionDiffPane with the tree in the docked rail', () => {
  it('draws the tree, the filter and Next unviewed in the rail host, never in the diff column', () => {
    renderPane({ diff: diffOf(FILES) });

    expect(hostOf().contains(treeOf())).toBe(true);
    expect(within(hostOf()).getByRole('textbox', { name: 'Filter files' })).toBeDefined();
    expect(within(hostOf()).getByRole('tablist', { name: 'Show files' })).toBeDefined();
    expect(within(hostOf()).getByRole('button', { name: /^Next unviewed/ })).toBeDefined();
    expect(screen.getByTestId('diff-view').contains(treeOf())).toBe(false);
  });

  it('puts no Files button, strip or rail head in the toolbar or the host', () => {
    renderPane({ diff: diffOf(FILES) });

    expect(
      within(screen.getByTestId('diff-toolbar')).queryByRole('button', { name: /^Files/ }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /^Fold the file rail/ })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize the file rail' })).toBeNull();
    expect(screen.queryByText(/of 2 viewed/)).toBeNull();
  });

  it('keeps the tree after a pick, and Escape does not hide it', () => {
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(within(treeOf()).getByRole('button', { name: /export\.ts/ }));
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
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
    (document.activeElement as HTMLElement).blur();

    pressShortcut({ id: 'diff.focusFilterAlias' });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
  });

  it('counts the unviewed files on the filter and the footer, from the whole review', () => {
    const diff = {
      ...diffOf(FILES),
      viewed: {
        stateOf: (file: FileDiff) =>
          file.path === FILE.path ? ('viewed' as const) : ('none' as const),
        onToggle: vi.fn(),
      },
    };
    renderPane({ diff });

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files' }), {
      target: { value: 'postings' },
    });

    expect(screen.getByRole('tab', { name: /^Unviewed/ }).textContent).toContain('1');
    expect(screen.getByRole('button', { name: /^Next unviewed/ }).textContent).toContain('1');
  });

  it('jumps to the next unviewed file from the footer and keeps the rail in place', () => {
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

  it('shows the same empty state, with no tree, when nothing changed', () => {
    renderPane({});

    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });
});

describe('SessionDiffPane with the rail hidden behind Sections', () => {
  it('draws no tree until the rail is open', () => {
    renderPane({ diff: diffOf(FILES), isOverlay: true });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(
      within(screen.getByTestId('diff-toolbar')).queryByRole('button', { name: /^Files/ }),
    ).toBeNull();
  });

  it('opens the rail and puts focus in the tree with the focus key', () => {
    renderPane({ diff: diffOf(FILES), isOverlay: true });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
  });

  it('opens the rail and puts focus in the filter field with the slash key', () => {
    renderPane({ diff: diffOf(FILES), isOverlay: true });

    pressShortcut({ id: 'diff.focusFilter' });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
  });

  it('closes the rail on a pick, and on a file comment requested from a row', () => {
    h.store['allowFileLevel'] = true;
    renderPane({ diff: diffOf(FILES), isOverlay: true });

    pressShortcut({ id: 'diff.focusTree' });
    fireEvent.click(within(treeOf()).getByRole('button', { name: /^export\.ts/ }));
    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();

    pressShortcut({ id: 'diff.focusTree' });
    fireEvent.click(screen.getByRole('button', { name: 'Comment on export.ts' }));
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
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
    expect(
      within(toolbar).getByRole('button', { name: 'Comparing develop ← feat/ledger-export' }),
    ).toBeDefined();
    expect(screen.queryByText('1 file')).toBeNull();
    expect(within(toolbar).queryByText('+3')).toBeNull();
  });

  it('keeps the comparison line when there is nothing to draw under it', () => {
    renderPane({});

    expect(screen.getByRole('button', { name: /Comparing/ })).toBeDefined();
    expect(screen.queryByTestId('diff-view')).toBeNull();
  });

  it('lists the changed files in a tree in the rail beside the code', () => {
    renderPane({ diff: diffOf([FILE]) });

    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    expect(within(tree).getByRole('button', { name: /postings\.ts/ })).toBeDefined();
    expect(within(tree).getByRole('button', { name: /^Next unviewed/ })).toBeDefined();
  });

  it('filters the tree and the diff together, then restores both on Clear', () => {
    const other: FileDiff = { ...FILE, path: 'src/ledger/export.ts' };
    renderPane({ diff: diffOf([FILE, other]) });

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files' }), {
      target: { value: 'export' },
    });

    expect(screen.getByText('Showing 1 of 2')).toBeDefined();
    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe('src/ledger/export.ts');
    expect(screen.queryByRole('button', { name: /postings\.ts/ })).toBeNull();

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

    fireEvent.click(screen.getByRole('tab', { name: /^Unviewed/ }));

    expect(screen.getByTestId('diff-view').getAttribute('data-files')).toBe('src/ledger/export.ts');
    expect(screen.getByText('Showing 1 of 2')).toBeDefined();
  });

  it('says no file matches and offers Clear in the diff when the filter hides everything', () => {
    renderPane({ diff: diffOf([FILE]) });

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files' }), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('No files match')).toBeDefined();
    expect(screen.queryByTestId('diff-view')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Clear' })).toHaveLength(3);
  });

  it('puts Write review in the file toolbar when a pull request can take one', () => {
    const onWriteReview = vi.fn();
    renderPane({ diff: diffOf([FILE]), onWriteReview });

    fireEvent.click(screen.getByRole('button', { name: 'Write review' }));
    expect(onWriteReview).toHaveBeenCalledOnce();
  });

  it('carries no Fix, Push, Rewrite, PR or Open in Review control of its own', () => {
    renderPane({ diff: diffOf([FILE]), onWriteReview: vi.fn() });

    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /Fix|Push|Rewrite|PR #|Open in Review/.test(name))).toEqual([]);
  });
});
