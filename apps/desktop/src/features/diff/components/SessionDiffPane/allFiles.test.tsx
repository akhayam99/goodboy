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

vi.mock('../../hooks/useDiffTokens', () => ({
  useDiffTokens: () => null,
  tokensForLine: () => null,
}));

vi.mock('./ChangesScopePill', () => ({
  ChangesScopePill: () => null,
}));

vi.mock('../DiffViewSelector', () => ({
  DiffViewSelector: () => <button type="button">Comparing</button>,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type FileDiff, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { SessionDiffPane } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const OTHER_SESSION_ID = brandId<SessionId>({ value: 'session-2' });
const WORKTREE = '/w/ledger';
const OTHER_WORKTREE = '/w/notify';

const modified = (path: string, additions: number, deletions: number): FileDiff => ({
  path,
  status: 'modified',
  additions,
  deletions,
  binary: false,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [
        { kind: 'del', oldLine: 1, newLine: null, text: 'old' },
        { kind: 'add', oldLine: null, newLine: 1, text: 'new' },
      ],
    },
  ],
});

const DELETED: FileDiff = { ...modified('ledger-core/src/old.ts', 0, 4), status: 'deleted' };

const FILES: ReadonlyArray<FileDiff> = [
  modified('ledger-core/src/ledger.ts', 3, 1),
  modified('ledger-core/src/rounding.ts', 2, 2),
  DELETED,
];

type Entry = {
  readonly name: string;
  readonly relPath: string;
  readonly isDir: boolean;
  readonly sizeBytes: number | null;
  readonly modifiedAt: string | null;
};

const entryOf = (relPath: string, isDir: boolean): Entry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir,
  sizeBytes: null,
  modifiedAt: null,
});

const LISTINGS: Readonly<Record<string, ReadonlyArray<Entry>>> = {
  '': [entryOf('ledger-core', true)],
  'ledger-core': [entryOf('ledger-core/src', true), entryOf('ledger-core/README.md', false)],
  'ledger-core/src': [
    entryOf('ledger-core/src/ledger.ts', false),
    entryOf('ledger-core/src/rounding.ts', false),
    entryOf('ledger-core/src/index.ts', false),
  ],
};

const listCalls: string[] = [];

type ListArgs = {
  readonly sessionDir: string;
  readonly relPath: string;
};

const listHandler = (args: ListArgs) => {
  listCalls.push(`${args.sessionDir}:${args.relPath}`);
  return LISTINGS[args.relPath] ?? [];
};

const diffOf = (files: ReadonlyArray<FileDiff>): SessionDiff => ({
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

const stableDiff = diffOf(FILES);
const emptyDiff = diffOf([]);

type HostProps = {
  readonly diff?: SessionDiff;
  readonly worktreePath?: string;
  readonly sessionId?: SessionId;
};

const Host = ({
  diff = stableDiff,
  worktreePath = WORKTREE,
  sessionId = SESSION_ID,
}: HostProps) => (
  <SessionDiffPane
    sessionId={sessionId}
    workingDir={worktreePath}
    worktreePath={worktreePath}
    diff={diff}
  />
);

const scrolled: Array<string | null> = [];

type ReadHandler = () => unknown;

let readHandler: ReadHandler = () => ({
  type: 'text',
  text: '# Ledger\n\nRounding rules.\n',
  truncated: false,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  scrolled.length = 0;
  listCalls.length = 0;
  localStorage.clear();
  installFakeResizeObserver();
  readHandler = () => ({ type: 'text', text: '# Ledger\n\nRounding rules.\n', truncated: false });
  stubStoryInvoke({
    explore_list: listHandler,
    explore_read: () => readHandler(),
    detect_editors: [],
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: function (this: Element) {
      scrolled.push(this.getAttribute('data-file-path'));
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const showAllFiles = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'All files' }));
};

const allTree = () => screen.findByRole('tree', { name: 'All files' });

const pressRow = async (relPath: string) => {
  const tree = await allTree();
  const row = await waitFor(() => {
    const found = tree.querySelector(`[data-tree-row="${relPath}"] button`);
    if (found === null) {
      throw new Error(`no row ${relPath}`);
    }
    return found;
  });
  fireEvent.click(row);
};

describe('Changes with its files mode', () => {
  it('opens in Changed with the diff count and the same files as before', () => {
    render(<Host />);

    expect(screen.getByRole('tab', { name: 'Changed 3' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const tree = screen.getByRole('tree', { name: 'Changed files' });
    expect(within(tree).getByRole('treeitem', { name: /ledger\.ts/ }).textContent).toContain(
      'ledger.ts',
    );
    expect(screen.queryByRole('tree', { name: 'All files' })).toBeNull();
    expect(listCalls).toEqual([]);
  });

  it('lists only the root when All files opens and loads a folder when it is opened', async () => {
    render(<Host />);

    showAllFiles();
    await allTree();
    await waitFor(() => expect(listCalls).toEqual([`${WORKTREE}:`]));

    await pressRow('ledger-core');
    await waitFor(() => expect(listCalls).toContain(`${WORKTREE}:ledger-core`));
    expect(listCalls).not.toContain(`${WORKTREE}:ledger-core/src`);
  });

  it('marks exactly the changed files, with the deleted one struck and the rest muted', async () => {
    render(<Host />);
    showAllFiles();
    await pressRow('ledger-core');
    await pressRow('ledger-core/src');

    const tree = await allTree();
    const changed = Array.from(tree.querySelectorAll('[data-changed="true"]')).map((node) =>
      node.getAttribute('data-tree-row'),
    );
    const unchanged = Array.from(tree.querySelectorAll('[data-changed="false"]')).map((node) =>
      node.getAttribute('data-tree-row'),
    );
    expect(changed.sort()).toEqual(FILES.map((file) => file.path).sort());
    expect(unchanged.sort()).toEqual(['ledger-core/README.md', 'ledger-core/src/index.ts']);
    const deletedRow = tree.querySelector('[data-tree-row="ledger-core/src/old.ts"]');
    expect(deletedRow?.querySelector('.line-through')).not.toBeNull();
    expect(
      tree.querySelector('[data-tree-row="ledger-core/README.md"] [data-slot="tree-delta"]'),
    ).toBeNull();
  });

  it('keeps the count and the totals of Changed while All files is shown', async () => {
    render(<Host />);
    const before = screen.getByRole('tab', { name: 'Changed 3' });

    showAllFiles();
    await allTree();

    expect(before.textContent).toBe('Changed 3');
    expect(screen.getByText('Viewed 0 of 3').textContent).toBe('Viewed 0 of 3');
  });

  it('scrolls to the diff when a changed file is clicked', async () => {
    render(<Host />);
    showAllFiles();
    await pressRow('ledger-core');
    await pressRow('ledger-core/src');
    await pressRow('ledger-core/src/rounding.ts');

    await waitFor(() => expect(scrolled).toContain('ledger-core/src/rounding.ts'));
    expect(screen.queryByText(/Unchanged against/)).toBeNull();
  });

  it('opens a deleted file at its diff', async () => {
    render(<Host />);
    showAllFiles();
    await pressRow('ledger-core');
    await pressRow('ledger-core/src');
    await pressRow('ledger-core/src/old.ts');

    await waitFor(() => expect(scrolled).toContain('ledger-core/src/old.ts'));
  });

  it('reads an unchanged file in place and goes back to the changes', async () => {
    render(<Host />);
    showAllFiles();
    await pressRow('ledger-core');
    await pressRow('ledger-core/README.md');

    expect((await screen.findByText(/Unchanged against/)).textContent).toContain('3 lines');
    fireEvent.click(screen.getByRole('button', { name: /Back to the changes/ }));
    expect(screen.queryByText(/Unchanged against/)).toBeNull();
  });

  it('says it could not read a file and retries in place', async () => {
    readHandler = () => {
      throw new Error('gone since the listing');
    };
    render(<Host />);
    showAllFiles();
    await pressRow('ledger-core');
    await pressRow('ledger-core/README.md');

    expect((await screen.findByText("Couldn't read this file")).textContent).toBe(
      "Couldn't read this file",
    );
    readHandler = () => ({ type: 'text', text: 'back\n', truncated: false });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findByText(/Unchanged against/)).textContent).toContain('1 lines');
  });

  it('offers All files when there are no changes', async () => {
    render(<Host diff={emptyDiff} />);

    fireEvent.click(screen.getByRole('button', { name: 'All files' }));

    expect((await allTree()).getAttribute('aria-label')).toBe('All files');
    expect(screen.getByText(/No changes against/).textContent).toContain('No changes against');
  });

  it('keeps the mode per session and folder', async () => {
    const { rerender } = render(<Host />);
    showAllFiles();
    await allTree();

    expect(useAppStore.getState().exploreChangedView[SESSION_ID]).toMatchObject({
      mountPath: WORKTREE,
      mode: 'all',
    });

    rerender(<Host sessionId={OTHER_SESSION_ID} />);
    expect(screen.queryByRole('tree', { name: 'All files' })).toBeNull();

    rerender(<Host worktreePath={OTHER_WORKTREE} />);
    expect(screen.queryByRole('tree', { name: 'All files' })).toBeNull();

    rerender(<Host />);
    expect((await allTree()).getAttribute('aria-label')).toBe('All files');
  });

  it('drops a listing that answers for the folder you left', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubStoryInvoke({
      explore_list: async (args: ListArgs) => {
        if (args.sessionDir === WORKTREE) {
          await gate;
          return [entryOf('stale-from-ledger.ts', false)];
        }
        return [entryOf('fresh-from-notify.ts', false)];
      },
      detect_editors: [],
    });
    useAppStore.getState().setExploreChangedView({
      sessionId: SESSION_ID,
      view: { mountPath: WORKTREE, mode: 'all', collapsed: {} },
    });
    useAppStore.getState().setExploreChangedView({
      sessionId: OTHER_SESSION_ID,
      view: { mountPath: OTHER_WORKTREE, mode: 'all', collapsed: {} },
    });
    const { rerender } = render(<Host diff={emptyDiff} />);

    rerender(<Host diff={emptyDiff} sessionId={OTHER_SESSION_ID} worktreePath={OTHER_WORKTREE} />);
    await act(async () => {
      release?.();
      await gate;
    });

    expect((await screen.findByText('fresh-from-notify.ts')).textContent).toBe(
      'fresh-from-notify.ts',
    );
    expect(screen.queryByText('stale-from-ledger.ts')).toBeNull();
  });
});
