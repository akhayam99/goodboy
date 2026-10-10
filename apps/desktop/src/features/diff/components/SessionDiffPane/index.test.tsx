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

import { DiffRailScope } from '../../DiffRailScope';
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
}: {
  readonly diff?: SessionDiff;
  readonly onWriteReview?: (() => void) | null;
}) =>
  render(
    <DiffRailScope isActive>
      <SessionDiffPane
        sessionId={SESSION_ID}
        workingDir="/w/ledger"
        worktreePath={MOUNT.worktreePath}
        diff={diff}
        onWriteReview={onWriteReview}
      />
    </DiffRailScope>,
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
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
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

const STRIP_PANE = 1196;
const BUTTON_PANE = 1100;
const DOCKED_PANE = 1920;

const paneAt = (width: number) =>
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

const railOf = (): HTMLElement => screen.getByRole('complementary', { name: 'Files' });

const treeOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Changed files' });

const toolbarFilesButton = (): HTMLElement | null =>
  within(screen.getByTestId('diff-toolbar')).queryByRole('button', { name: /^Files, / });

describe('SessionDiffPane with the tree in a strip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the tree in a strip with the reading progress', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' })).toBeDefined();
    expect(screen.getByText('0/2')).toBeDefined();
    expect(toolbarFilesButton()).toBeNull();
  });

  it('opens the tree over the diff from the strip and closes it on a pick', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));
    expect(railOf().getAttribute('data-rail')).toBe('overlay');
    fireEvent.click(within(treeOf()).getByRole('button', { name: /export\.ts/ }));

    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('closes the tree overlay when a file comment is requested from a row', () => {
    paneAt(STRIP_PANE);
    h.store['allowFileLevel'] = true;
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comment on export.ts' }));

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('keeps the strip on the whole review while the tree is filtered', () => {
    paneAt(STRIP_PANE);
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
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
    expect(railOf().getAttribute('data-rail')).toBe('overlay');
  });

  it('opens the tree and puts focus in the filter field with the slash key', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });
    const strip = screen.getByRole('button', { name: 'Files, 0 of 2 viewed' });

    pressShortcut({ id: 'diff.focusFilter' });

    expect(strip.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
  });

  it('focuses the filter with T too, the same as the slash', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusFilterAlias' });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
  });

  it('closes the open tree with Escape and hands focus back to the strip', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });
    const strip = screen.getByRole('button', { name: 'Files, 0 of 2 viewed' });

    fireEvent.click(strip);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(document.activeElement).toBe(strip);
  });

  it('closes the open tree on a click outside it, and leaves it open on a click inside', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });
    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));

    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Filter files' }));
    expect(treeOf()).toBeDefined();

    fireEvent.pointerDown(screen.getByTestId('diff-view'));
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('closes the open tree with the strip itself, and with the close button in its head', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });
    const strip = screen.getByRole('button', { name: 'Files, 0 of 2 viewed' });

    fireEvent.click(strip);
    fireEvent.click(strip);
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();

    fireEvent.click(strip);
    fireEvent.click(screen.getByRole('button', { name: 'Close the file rail' }));
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(document.activeElement).toBe(strip);
  });

  it('opens and closes the overlay with the toggle key, where the rail cannot dock', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.toggleTree' });
    expect(railOf().getAttribute('data-rail')).toBe('overlay');

    pressShortcut({ id: 'diff.toggleTree' });
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('offers no resize handle on the overlay', () => {
    paneAt(STRIP_PANE);
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));

    expect(screen.queryByRole('separator', { name: 'Resize the file rail' })).toBeNull();
  });
});

describe('SessionDiffPane with the tree as a toolbar button', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows no strip and puts Files 0/2 first in the toolbar, before the comparison', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });

    const buttons = within(screen.getByTestId('diff-toolbar')).getAllByRole('button');
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Files, 0 of 2 viewed');
    expect(buttons[0]?.textContent).toBe('Files0/2');
    expect(buttons[1]?.textContent).toMatch(/^Comparing/);
    expect(screen.getAllByRole('button', { name: 'Files, 0 of 2 viewed' })).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('opens the same overlay from the button and closes it on a pick', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(toolbarFilesButton() as HTMLElement);
    expect(toolbarFilesButton()?.getAttribute('aria-expanded')).toBe('true');
    expect(railOf().getAttribute('data-rail')).toBe('overlay');
    fireEvent.click(within(treeOf()).getByRole('button', { name: /export\.ts/ }));

    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('opens the overlay with F and puts focus in the tree', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusTree' });

    expect(treeOf().contains(document.activeElement)).toBe(true);
  });

  it('opens the overlay with the slash and focuses the filter', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusFilter' });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
  });

  it('closes the overlay with Escape and hands focus back to the button', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });
    const button = toolbarFilesButton() as HTMLElement;

    fireEvent.click(button);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes the overlay on a click outside, but not on the button that opened it', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });
    const button = toolbarFilesButton() as HTMLElement;
    fireEvent.click(button);

    fireEvent.pointerDown(button);
    expect(treeOf()).toBeDefined();
    fireEvent.pointerDown(screen.getByTestId('diff-view'));

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('toggles the overlay with the toggle key', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.toggleTree' });
    expect(treeOf()).toBeDefined();
    pressShortcut({ id: 'diff.toggleTree' });

    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('keeps the button next to the comparison while the filter hides every file', () => {
    paneAt(BUTTON_PANE);
    renderPane({ diff: diffOf(FILES) });
    fireEvent.click(toolbarFilesButton() as HTMLElement);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files' }), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('No files match')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Files, 0 of 2 viewed' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Comparing/ })).toBeDefined();
  });

  it('shows the same empty state, with no tree control, when nothing changed', () => {
    paneAt(BUTTON_PANE);
    renderPane({});

    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Files/ })).toBeNull();
  });

  it('shows the same empty state in a strip width, with no strip', () => {
    paneAt(STRIP_PANE);
    renderPane({});

    expect(screen.getByText('Branch matches its base branch')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Files/ })).toBeNull();
  });
});

describe('SessionDiffPane with the tree docked in the rail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('docks the tree with a head naming the files and their number, and a resize handle', () => {
    paneAt(DOCKED_PANE);
    renderPane({ diff: diffOf(FILES) });

    expect(railOf().getAttribute('data-rail')).toBe('docked');
    expect(within(railOf()).getByText('Files')).toBeDefined();
    expect(within(railOf()).getByText('2')).toBeDefined();
    expect(within(railOf()).getByText('0 of 2 viewed')).toBeDefined();
    expect(screen.getByRole('separator', { name: 'Resize the file rail' })).toBeDefined();
    expect(toolbarFilesButton()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Files, 0 of 2 viewed' })).toBeNull();
  });

  it('folds the rail to the strip with the toggle key and docks it again with the same key', () => {
    paneAt(DOCKED_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.toggleTree' });
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' })).toBeDefined();

    pressShortcut({ id: 'diff.toggleTree' });
    expect(railOf().getAttribute('data-rail')).toBe('docked');
    expect(screen.queryByRole('button', { name: 'Files, 0 of 2 viewed' })).toBeNull();
  });

  it('folds with the button in the head and hands focus to the strip', () => {
    paneAt(DOCKED_PANE);
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(screen.getByRole('button', { name: 'Fold the file rail' }));

    const strip = screen.getByRole('button', { name: 'Files, 0 of 2 viewed' });
    expect(strip.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(strip);
  });

  it('docks a folded rail again from the strip, and with F, which then focuses the tree', () => {
    paneAt(DOCKED_PANE);
    renderPane({ diff: diffOf(FILES) });
    pressShortcut({ id: 'diff.toggleTree' });

    fireEvent.click(screen.getByRole('button', { name: 'Files, 0 of 2 viewed' }));
    expect(railOf().getAttribute('data-rail')).toBe('docked');

    pressShortcut({ id: 'diff.toggleTree' });
    pressShortcut({ id: 'diff.focusTree' });
    expect(railOf().getAttribute('data-rail')).toBe('docked');
    expect(treeOf().contains(document.activeElement)).toBe(true);
  });

  it('keeps the rail docked after a pick, and Escape does not fold it', () => {
    paneAt(DOCKED_PANE);
    renderPane({ diff: diffOf(FILES) });

    fireEvent.click(within(treeOf()).getByRole('button', { name: /export\.ts/ }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(h.scroll).toHaveBeenCalledWith('src/ledger/export.ts');
    expect(railOf().getAttribute('data-rail')).toBe('docked');
  });

  it('focuses the filter with the slash while docked', () => {
    paneAt(DOCKED_PANE);
    renderPane({ diff: diffOf(FILES) });

    pressShortcut({ id: 'diff.focusFilter' });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter files' }));
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
