// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  threads: [] as ReadonlyArray<DiffThread>,
  noteSubmit: vi.fn(),
  noteDelete: vi.fn(),
}));

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
vi.mock('../useDiffReviewThreads', () => ({ useDiffReviewThreads: () => [] }));
vi.mock('../useDiffNotes', () => ({
  useDiffNotes: () => ({
    comments: {
      threads: h.threads,
      submitLabel: 'Add note',
      composerLabel: 'Note',
      allowFileLevel: true,
      onSubmit: h.noteSubmit,
      onDelete: h.noteDelete,
    },
    fixes: [],
  }),
}));

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { FileDiff, IsoDateTime, SessionId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../store/storyHarness';
import type { DiffThread } from '../../components/DiffView/types';
import type { SessionDiff } from '../useSessionDiff';
import { useReviewState } from '.';

const fileAt = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
});

const threadAt = ({
  id,
  filePath,
  isResolved,
}: {
  readonly id: string;
  readonly filePath: string;
  readonly isResolved: boolean;
}): DiffThread => ({
  id,
  filePath,
  anchor: null,
  body: 'Check the rounding',
  tone: 'neutral',
  author: 'You',
  isAgent: false,
  createdAt: '2026-10-05T08:00:00.000Z' as IsoDateTime,
  statusLabel: 'Open',
  isResolved,
  canEdit: false,
  canClose: true,
  canReopen: false,
});

const diffOf = (focusFile: (path: string) => void): SessionDiff => ({
  files: [fileAt('src/ledger/export/page.tsx'), fileAt('src/ledger/ledger.ts')],
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
  focusFile,
});

const run = (focusFile: (path: string) => void = vi.fn()) =>
  renderHook(() =>
    useReviewState({
      sessionId: 'session-1' as SessionId,
      worktreePath: '/w/ledger',
      diff: diffOf(focusFile),
    }),
  );

let store: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

afterEach(() => {
  h.threads = [];
});

describe('useReviewState', () => {
  it('opens the folders above the file the diff scrolled to', () => {
    const { result } = run();
    act(() => result.current.toggleFolder('src/ledger/export'));
    act(() => result.current.toggleFolder('src/ledger'));
    expect(result.current.collapsed.has('src/ledger')).toBe(true);

    act(() => result.current.setActivePath('src/ledger/export/page.tsx'));

    expect(result.current.collapsed.has('src/ledger')).toBe(false);
    expect(result.current.collapsed.has('src/ledger/export')).toBe(false);
    expect(result.current.activePath).toBe('src/ledger/export/page.tsx');
  });

  it('jumps by marking the file active, opening its folder and asking the diff to scroll', () => {
    const focusFile = vi.fn();
    const { result } = run(focusFile);
    act(() => result.current.setActivePath('src/ledger/export/page.tsx'));
    act(() => result.current.toggleFolder('src/ledger/export'));

    act(() => result.current.jumpTo('src/ledger/export/page.tsx'));

    expect(result.current.collapsed.has('src/ledger/export')).toBe(false);
    expect(focusFile).toHaveBeenCalledWith('src/ledger/export/page.tsx');
  });

  it('counts open notes per file and ignores resolved ones', () => {
    h.threads = [
      threadAt({ id: 'a', filePath: 'src/ledger/ledger.ts', isResolved: false }),
      threadAt({ id: 'b', filePath: 'src/ledger/ledger.ts', isResolved: false }),
      threadAt({ id: 'c', filePath: 'src/ledger/ledger.ts', isResolved: true }),
    ];
    const { result } = run();

    expect(result.current.noteCountOf('src/ledger/ledger.ts')).toBe(2);
    expect(result.current.noteCountOf('src/ledger/export/page.tsx')).toBe(0);
  });

  it('builds the tree from the diff files', () => {
    const { result } = run();

    expect(result.current.tree.files.map((file) => file.path)).toEqual([
      'src/ledger/export/page.tsx',
      'src/ledger/ledger.ts',
    ]);
  });
});

describe('useReviewState filters', () => {
  const FILES = [
    fileAt('src/ledger/export/page.tsx'),
    fileAt('src/ledger/ledger.ts'),
    fileAt('pnpm-lock.yaml'),
  ];
  const STABLE: SessionDiff = {
    ...diffOf(vi.fn()),
    files: FILES,
    viewed: {
      stateOf: (file) => (file.path === 'src/ledger/ledger.ts' ? 'viewed' : 'none'),
      onToggle: vi.fn(),
    },
  };
  const runStable = () =>
    renderHook(() =>
      useReviewState({
        sessionId: 'session-1' as SessionId,
        worktreePath: '/w/ledger',
        diff: STABLE,
      }),
    );
  const shown = (result: { readonly current: ReturnType<typeof useReviewState> }) =>
    result.current.tree.files.map((file) => file.path);

  it('filters the tree files by the typed query and keeps the full list for the head', () => {
    const { result } = runStable();

    act(() => result.current.setQuery('exp'));

    expect(shown(result)).toEqual(['src/ledger/export/page.tsx']);
    expect(result.current.allFiles).toHaveLength(3);
    expect(result.current.isFiltering).toBe(true);
  });

  it('keeps only files that are not viewed when Unviewed is on', () => {
    const { result } = runStable();

    act(() => result.current.setUnviewedOnly(true));

    expect(shown(result)).toEqual(['src/ledger/export/page.tsx', 'pnpm-lock.yaml']);
  });

  it('keeps only files with open notes when With notes is on', () => {
    h.threads = [
      threadAt({ id: 'a', filePath: 'src/ledger/ledger.ts', isResolved: false }),
      threadAt({ id: 'b', filePath: 'src/ledger/export/page.tsx', isResolved: true }),
    ];
    const { result } = runStable();

    act(() => result.current.setNotesOnly(true));

    expect(shown(result)).toEqual(['src/ledger/ledger.ts']);
  });

  it('combines the chips with the query and drops all of them on clear', () => {
    const { result } = runStable();

    act(() => {
      result.current.setQuery('ledger');
      result.current.setUnviewedOnly(true);
    });
    expect(shown(result)).toEqual(['src/ledger/export/page.tsx']);

    act(() => result.current.clearFilters());

    expect(shown(result)).toHaveLength(3);
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.query).toBe('');
  });

  it('starts with the Generated row closed and opens it when a generated file is the target', () => {
    const { result } = runStable();
    expect(result.current.collapsed.has('group:generated')).toBe(true);

    act(() => result.current.setActivePath('pnpm-lock.yaml'));

    expect(result.current.collapsed.has('group:generated')).toBe(false);
  });

  it('regroups the tree by kind', () => {
    const { result } = runStable();

    act(() => result.current.setGroup('kind'));

    expect(
      result.current.tree.rows.filter((row) => row.kind === 'folder').map((row) => row.label),
    ).toEqual(['Source', 'Generated']);
  });
});

describe('useReviewState file-level comments', () => {
  const SESSION = 'session-1' as SessionId;
  const PULL_REQUEST = {
    sessionId: SESSION,
    provider: 'github' as const,
    externalId: '318',
    identifier: '#318',
    url: 'https://github.com/harborline/ledger-core/pull/318',
    title: 'Ledger export',
    createdAt: '2026-10-05T08:00:00.000Z' as IsoDateTime,
  };
  const FILE_DRAFT = {
    id: 'draft-file',
    sessionId: SESSION,
    provider: 'github' as const,
    repo: 'harborline/ledger-core',
    prNumber: 318,
    path: 'src/ledger/ledger.ts',
    line: 0,
    startLine: null,
    side: 'new' as const,
    body: 'Split this file',
    status: 'draft' as const,
    stale: false,
    origin: 'user' as const,
    createdAt: '2026-10-05T08:00:00.000Z' as IsoDateTime,
  };
  const stubDrafts = () => {
    const addReviewDraft = vi.fn(async () => FILE_DRAFT);
    const updateReviewDraft = vi.fn(async () => undefined);
    const discardReviewDraft = vi.fn(async () => undefined);
    store.setState({
      addReviewDraft,
      updateReviewDraft,
      discardReviewDraft,
      loadReviewDrafts: vi.fn(async () => undefined),
    });
    return { addReviewDraft, updateReviewDraft, discardReviewDraft };
  };
  const withPullRequest = () =>
    store.setState({ sessionExternalTasks: { [SESSION]: [PULL_REQUEST] } });

  afterEach(() => {
    store.setState({ sessionExternalTasks: {}, reviewDrafts: {} });
    h.noteSubmit.mockClear();
    h.noteDelete.mockClear();
  });

  it('keeps a file comment as a local note when the branch has no pull request', () => {
    const drafts = stubDrafts();
    const { result } = run();

    act(() => result.current.comments.onSubmit('src/ledger/ledger.ts', null, 'Split this file'));

    expect(h.noteSubmit).toHaveBeenCalledWith('src/ledger/ledger.ts', null, 'Split this file');
    expect(drafts.addReviewDraft).not.toHaveBeenCalled();
    expect(result.current.comments.fileComposer).toBeUndefined();
  });

  it('drafts a file-level review comment when the branch has a pull request', () => {
    const drafts = stubDrafts();
    withPullRequest();
    const { result } = run();

    act(() => result.current.comments.onSubmit('src/ledger/ledger.ts', null, 'Split this file'));

    expect(drafts.addReviewDraft).toHaveBeenCalledWith({
      sessionId: SESSION,
      path: 'src/ledger/ledger.ts',
      line: 0,
      body: 'Split this file',
    });
    expect(h.noteSubmit).not.toHaveBeenCalled();
    expect(result.current.comments.fileComposer).toEqual({
      label: 'Draft on this file',
      submitLabel: 'Add draft',
    });
  });

  it('still saves a line comment as a note when the branch has a pull request', () => {
    stubDrafts();
    withPullRequest();
    const { result } = run();
    const anchor = { side: 'new' as const, lineNumber: 12 };

    act(() => result.current.comments.onSubmit('src/ledger/ledger.ts', anchor, 'Guard this'));

    expect(h.noteSubmit).toHaveBeenCalledWith('src/ledger/ledger.ts', anchor, 'Guard this');
  });

  it('shows a file-level draft as a thread on the file with no anchor and counts it', () => {
    stubDrafts();
    withPullRequest();
    store.setState({ reviewDrafts: { [SESSION]: [FILE_DRAFT] } });
    const { result } = run();

    const shown = result.current.comments.threads.find((thread) => thread.id === 'draft-file');
    expect(shown).toMatchObject({
      filePath: 'src/ledger/ledger.ts',
      anchor: null,
      body: 'Split this file',
      canEdit: true,
    });
    expect(result.current.noteCountOf('src/ledger/ledger.ts')).toBe(1);
  });

  it('leaves line drafts to the Write review view', () => {
    stubDrafts();
    withPullRequest();
    store.setState({ reviewDrafts: { [SESSION]: [{ ...FILE_DRAFT, id: 'line-draft', line: 7 }] } });
    const { result } = run();

    expect(result.current.comments.threads.map((thread) => thread.id)).not.toContain('line-draft');
  });

  it('edits and discards a file draft through the draft store, and other threads through notes', () => {
    const drafts = stubDrafts();
    withPullRequest();
    store.setState({ reviewDrafts: { [SESSION]: [FILE_DRAFT] } });
    const { result } = run();

    act(() => result.current.comments.onEdit?.('draft-file', 'Split it in two'));
    act(() => result.current.comments.onDelete?.('draft-file'));
    act(() => result.current.comments.onDelete?.('a-note'));

    expect(drafts.updateReviewDraft).toHaveBeenCalledWith('draft-file', 'Split it in two');
    expect(drafts.discardReviewDraft).toHaveBeenCalledWith('draft-file');
    expect(h.noteDelete).toHaveBeenCalledWith('a-note');
    expect(h.noteDelete).not.toHaveBeenCalledWith('draft-file');
  });

  it('asks the diff to jump to a file and open its composer, until the diff says it did', () => {
    const focusFile = vi.fn();
    const { result } = run(focusFile);

    act(() => result.current.commentOnFile('src/ledger/ledger.ts'));

    expect(focusFile).toHaveBeenCalledWith('src/ledger/ledger.ts');
    expect(result.current.fileCommentPath).toBe('src/ledger/ledger.ts');

    act(() => result.current.clearFileComment());

    expect(result.current.fileCommentPath).toBeNull();
  });
});

describe('useReviewState on a big change', () => {
  const bigFiles = [
    ...Array.from({ length: 320 }, (_, index) => fileAt(`apps/web/c${index}.ts`)),
    ...Array.from({ length: 20 }, (_, index) => fileAt(`apps/api/r${index}.ts`)),
  ];

  const runBig = (files: ReadonlyArray<FileDiff>) =>
    renderHook(
      ({ current }) =>
        useReviewState({
          sessionId: 'session-1' as SessionId,
          worktreePath: '/w/ledger',
          diff: current,
        }),
      { initialProps: { current: { ...diffOf(vi.fn()), files } } },
    );

  const reload = (files: ReadonlyArray<FileDiff>) => ({
    current: { ...diffOf(vi.fn()), files },
  });

  it('starts with the folders over 50 files closed', () => {
    const { result } = runBig(bigFiles);

    expect([...result.current.collapsed]).toEqual(['apps/web']);
  });

  it('opens a closed folder when the diff jumps into it', () => {
    const { result } = runBig(bigFiles);

    act(() => result.current.jumpTo('apps/web/c10.ts'));

    expect(result.current.collapsed.has('apps/web')).toBe(false);
  });

  it('closes the big folders again when a different set of files arrives', () => {
    const { result, rerender } = runBig(bigFiles);
    act(() => result.current.toggleFolder('apps/web'));
    expect(result.current.collapsed.size).toBe(0);

    rerender(reload([...bigFiles, fileAt('apps/web/new.ts')]));

    expect([...result.current.collapsed]).toEqual(['apps/web']);
  });

  it('keeps what the reader opened when the same files reload', () => {
    const { result, rerender } = runBig(bigFiles);
    act(() => result.current.toggleFolder('apps/web'));

    rerender(reload([...bigFiles]));

    expect(result.current.collapsed.size).toBe(0);
  });

  it('leaves a small change fully open', () => {
    const { result } = runBig(bigFiles.slice(0, 80));

    expect(result.current.collapsed.size).toBe(0);
  });
});
