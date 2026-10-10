// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { FileDiff, IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { SessionDiff } from '../useSessionDiff';
import { useReviewState } from '.';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION = 'session-ledger-export' as SessionId;

const PULL_REQUEST = {
  id: 'task-318',
  sessionId: SESSION,
  provider: 'github' as const,
  externalId: '318',
  identifier: '#318',
  url: 'https://github.com/harborline/ledger-core/pull/318',
  title: 'Ledger export',
  createdAt: '2026-10-05T08:00:00.000Z' as IsoDateTime,
};

const file: FileDiff = {
  path: 'src/ledger/ledger.ts',
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
};

const diffOf = (): SessionDiff => ({
  files: [file],
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

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION, workspaceId: WORKSPACE_ID }));
  useAppStore.setState({ sessionExternalTasks: { [SESSION]: [PULL_REQUEST] } });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ sessionExternalTasks: {} });
});

describe('useReviewState on sqlite, with a pull request open', () => {
  it('saves a comment on a file as a note with no anchor and writes no review draft', async () => {
    const { result } = renderHook(
      () => useReviewState({ sessionId: SESSION, worktreePath: null, diff: diffOf() }),
      { wrapper },
    );

    expect(result.current.comments.composerLabel).toBe('Note');
    expect(result.current.comments.submitLabel).toBe('Add note');
    expect(result.current.comments.fileComposer).toBeUndefined();

    await act(async () => {
      result.current.comments.onSubmit('src/ledger/ledger.ts', null, 'Split this file');
    });

    await waitFor(async () => {
      const notes = await rowsOf<{ file_path: string; body: string; line_number: number | null }>({
        sql: 'SELECT file_path, body, line_number FROM diff_comments',
      });
      expect(notes).toEqual([
        { file_path: 'src/ledger/ledger.ts', body: 'Split this file', line_number: null },
      ]);
    });
    expect(await rowsOf({ sql: 'SELECT id FROM pr_review_drafts' })).toEqual([]);
  });
});
