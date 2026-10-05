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

import { SessionDiffPane } from './index';

const diffOf = (files: ReadonlyArray<FileDiff> = []): SessionDiff => ({
  files,
  patch: '',
  loading: false,
  error: null,
  view: { kind: 'branch' },
  setView: vi.fn(),
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
}: {
  readonly diff?: SessionDiff;
  readonly onWriteReview?: (() => void) | null;
}) =>
  render(
    <SessionDiffPane
      sessionId={SESSION_ID}
      workingDir="/w/ledger"
      worktreePath={MOUNT.worktreePath}
      diff={diff}
      onWriteReview={onWriteReview}
    />,
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

  it('puts the empty message in the tree column, with the key line under it', () => {
    renderPane({});

    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    expect(within(tree).getByText('0 files')).toBeDefined();
    expect(within(tree).getByText('Branch matches its base branch')).toBeDefined();
  });
});

describe('SessionDiffPane at a narrow width', () => {
  const FILES: ReadonlyArray<FileDiff> = [FILE, { ...FILE, path: 'src/ledger/export.ts' }];

  const squeeze = (width: number) =>
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width,
      height: 600,
      top: 0,
      left: 0,
      right: width,
      bottom: 600,
      x: 0,
      y: 0,
    } as DOMRect);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the tree in a strip with the reading progress', () => {
    squeeze(700);
    renderPane({ diff: diffOf(FILES) });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' })).toBeDefined();
    expect(screen.getByText('0/2')).toBeDefined();
  });

  it('opens the tree over the diff from the strip and closes it on a pick', () => {
    squeeze(700);
    const diff = diffOf(FILES);
    renderPane({ diff });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));
    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    fireEvent.click(within(tree).getByRole('button', { name: /export\.ts/ }));

    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('closes the tree overlay when a file comment is requested from a row', () => {
    squeeze(700);
    h.store['allowFileLevel'] = true;
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comment on export.ts' }));

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('keeps the strip on the whole review while the tree is filtered', () => {
    squeeze(700);
    const diff = {
      ...diffOf(FILES),
      viewed: {
        stateOf: (file: FileDiff) =>
          file.path === FILE.path ? ('viewed' as const) : ('none' as const),
        onToggle: vi.fn(),
      },
    };
    renderPane({ diff });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 1 of 2 viewed' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files' }), {
      target: { value: 'postings' },
    });

    expect(screen.getByText('1/2')).toBeDefined();
  });

  it('opens the tree and puts focus in it with the focus key', () => {
    squeeze(700);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    expect(tree.contains(document.activeElement)).toBe(true);
  });

  it('opens the tree and puts focus in the filter field with the slash key', () => {
    squeeze(700);
    renderPane({ diff: diffOf(FILES) });
    const strip = screen.getByRole('button', { name: 'Files, 0 of 2 viewed' });

    pressShortcut({ id: 'diff.focusFilter' });

    expect(strip.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
  });

  it('closes the open tree with Escape and hands focus back to the strip', () => {
    squeeze(700);
    renderPane({ diff: diffOf(FILES) });
    const strip = screen.getByRole('button', { name: 'Files, 0 of 2 viewed' });

    fireEvent.click(strip);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(document.activeElement).toBe(strip);
  });

  it('shows the empty message in the pane when there is no tree column', () => {
    squeeze(700);
    renderPane({});

    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
  });

  it('docks the tree at a wide width and hides it to a strip with the toggle key', () => {
    squeeze(1200);
    renderPane({ diff: diffOf(FILES) });
    expect(screen.getByRole('navigation', { name: 'Changed files' })).toBeDefined();

    pressShortcut({ id: 'diff.toggleTree' });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' })).toBeDefined();
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

  it('lists the changed files in a tree beside the code', () => {
    renderPane({ diff: diffOf([FILE]) });

    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    expect(within(tree).getByText('0 of 1 viewed')).toBeDefined();
    expect(within(tree).getByRole('button', { name: /postings\.ts/ })).toBeDefined();
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

  it('keeps only unviewed files when the Unviewed chip is on', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Unviewed' }));

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
