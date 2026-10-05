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
    expect(result.current.collapsed.size).toBe(2);

    act(() => result.current.setActivePath('src/ledger/export/page.tsx'));

    expect(result.current.collapsed.size).toBe(0);
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
