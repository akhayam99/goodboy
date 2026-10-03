import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from './storyHarness';
import { noteThreadId } from '../features/resolve/notes/noteThread';
import { noteFixesOf } from '../features/diff/lib/noteFixes';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-ledger-rounding' as SessionId;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, 'Round the ledger', 'idle', 1, 1)",
    [SESSION_ID, WORKSPACE_ID],
  );
  useAppStore.setState({ workspaces: [workspace], currentWorkspaceId: WORKSPACE_ID });
});

type NoteRow = { readonly status: string };
type ThreadRow = { readonly thread_id: string; readonly state: string; readonly stage: string };

const noteStatus = async (): Promise<ReadonlyArray<string>> =>
  (await rowsOf<NoteRow>({ sql: 'SELECT status FROM diff_comments' })).map((row) => row.status);

const threads = (): Promise<ReadonlyArray<ThreadRow>> =>
  rowsOf<ThreadRow>({
    sql: 'SELECT thread_id, state, stage FROM resolve_threads ORDER BY generation',
  });

const addNote = async (): Promise<string> => {
  await useAppStore
    .getState()
    .addDiffComment(SESSION_ID, 'src/ledger/rounding.ts', 'Round half to even', {
      side: 'new',
      lineNumber: 42,
    });
  const [note] = useAppStore.getState().diffComments[SESSION_ID] ?? [];
  if (note === undefined) {
    throw new Error('the note was not written');
  }
  return note.id;
};

describe('store on sqlite: Close note', () => {
  it('closes the note, its conversation and its queue item in one path', async () => {
    const noteId = await addNote();
    expect(await threads()).toEqual([
      { thread_id: noteThreadId({ noteId }), state: 'open', stage: 'new' },
    ]);

    await useAppStore
      .getState()
      .closeResolvedNote({ sessionId: SESSION_ID, threadId: noteThreadId({ noteId }) });

    expect(await noteStatus()).toEqual(['resolved']);
    expect(await threads()).toEqual([
      { thread_id: noteThreadId({ noteId }), state: 'closed', stage: 'resolved' },
    ]);
    const state = useAppStore.getState();
    const [fix] = noteFixesOf({
      notes: state.diffComments[SESSION_ID] ?? [],
      entries: state.sessionResolveQueueItems[SESSION_ID] ?? [],
      attempts: state.sessionResolveAttempts[SESSION_ID] ?? [],
    });
    expect([fix?.group, fix?.word, fix?.canFix]).toEqual(['done', 'Closed', false]);
  });

  it('closes the live generation of a reopened note when given its first thread id', async () => {
    const noteId = await addNote();
    const first = noteThreadId({ noteId });
    await useAppStore.getState().closeResolvedNote({ sessionId: SESSION_ID, threadId: first });
    await useAppStore.getState().reopenDiffComment(SESSION_ID, noteId);

    await useAppStore.getState().closeResolvedNote({ sessionId: SESSION_ID, threadId: first });

    expect(await noteStatus()).toEqual(['resolved']);
    expect((await threads()).map((row) => [row.thread_id, row.state])).toEqual([
      [first, 'closed'],
      [noteThreadId({ noteId, generation: 1 }), 'closed'],
    ]);
  });
});
