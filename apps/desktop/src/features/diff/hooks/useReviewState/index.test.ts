// @vitest-environment happy-dom

const h = vi.hoisted(() => ({ threads: [] as ReadonlyArray<DiffThread> }));

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
      onSubmit: () => undefined,
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

beforeAll(async () => {
  await importStore();
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
