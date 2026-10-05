import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
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
    expect([fix?.group, fix?.word]).toEqual(['done', 'Closed']);
  });

  it('saves the project and the branch of the active mount with a new note', async () => {
    useAppStore.setState({
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            mountId: 'mount-ledger' as MountId,
            sessionId: SESSION_ID,
            projectId: 'project-ledger-core' as ProjectId,
            mountName: 'ledger-core',
            worktreePath: '/wt/ledger-core',
            lastWorktreePath: null,
            repoRoot: '/repo/ledger-core',
            branch: 'feat/rounding',
            baseBranch: 'main',
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 1,
          },
        ],
      },
    });
    await addNote();
    const rows = await rowsOf<{ readonly project_id: string; readonly branch: string }>({
      sql: 'SELECT project_id, branch FROM diff_comments',
    });
    expect(rows).toEqual([{ project_id: 'project-ledger-core', branch: 'feat/rounding' }]);
    const [note] = useAppStore.getState().diffComments[SESSION_ID] ?? [];
    expect(note).toMatchObject({ projectId: 'project-ledger-core', branch: 'feat/rounding' });
  });

  it('assigns an unassigned note to the active branch', async () => {
    const noteId = await addNote();
    expect(useAppStore.getState().diffComments[SESSION_ID]?.[0]?.branch).toBeUndefined();
    useAppStore.setState({
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            mountId: 'mount-ledger' as MountId,
            sessionId: SESSION_ID,
            projectId: 'project-ledger-core' as ProjectId,
            mountName: 'ledger-core',
            worktreePath: '/wt/ledger-core',
            lastWorktreePath: null,
            repoRoot: '/repo/ledger-core',
            branch: 'feat/rounding',
            baseBranch: 'main',
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 1,
          },
        ],
      },
    });
    await useAppStore.getState().assignDiffComment(SESSION_ID, noteId);
    expect(useAppStore.getState().diffComments[SESSION_ID]?.[0]).toMatchObject({
      projectId: 'project-ledger-core',
      branch: 'feat/rounding',
    });
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

type StoredNote = {
  readonly id: string;
  readonly body: string;
  readonly status: string;
  readonly created_at: number;
  readonly line_number: number | null;
  readonly line_side: string | null;
};

const storedNotes = (): Promise<ReadonlyArray<StoredNote>> =>
  rowsOf<StoredNote>({
    sql: 'SELECT id, body, status, created_at, line_number, line_side FROM diff_comments ORDER BY created_at, id',
  });

const addSecondNote = async (): Promise<string> => {
  await useAppStore
    .getState()
    .addDiffComment(SESSION_ID, 'src/ledger/export.ts', 'Rename PAGE_SIZE');
  const added = (useAppStore.getState().diffComments[SESSION_ID] ?? []).find(
    (note) => note.body === 'Rename PAGE_SIZE',
  );
  if (added === undefined) {
    throw new Error('the second note was not written');
  }
  return added.id;
};

describe('store on sqlite: Discard note', () => {
  it('removes the note and brings back the same row on Undo', async () => {
    const noteId = await addNote();
    const before = await storedNotes();

    await useAppStore.getState().discardDiffComments({ sessionId: SESSION_ID, ids: [noteId] });

    expect(await storedNotes()).toEqual([]);
    expect(useAppStore.getState().diffComments[SESSION_ID]).toEqual([]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);

    expect(await useAppStore.getState().undoLastOperation({})).toBe(true);

    expect(await storedNotes()).toEqual(before);
    expect(useAppStore.getState().diffComments[SESSION_ID]?.[0]).toMatchObject({
      id: noteId,
      body: 'Round half to even',
      anchor: { side: 'new', lineNumber: 42 },
    });
  });

  it('keeps a closed note closed when it is brought back', async () => {
    const noteId = await addNote();
    await useAppStore
      .getState()
      .closeResolvedNote({ sessionId: SESSION_ID, threadId: noteThreadId({ noteId }) });

    await useAppStore.getState().discardDiffComments({ sessionId: SESSION_ID, ids: [noteId] });
    await useAppStore.getState().undoLastOperation({});

    expect(await noteStatus()).toEqual(['resolved']);
  });

  it('discards several notes as one operation and Undo restores them all', async () => {
    const first = await addNote();
    const second = await addSecondNote();

    await useAppStore
      .getState()
      .discardDiffComments({ sessionId: SESSION_ID, ids: [first, second] });

    expect(await storedNotes()).toEqual([]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toBe('2 notes discarded');

    await useAppStore.getState().undoLastOperation({});

    expect((await storedNotes()).map((row) => row.id).sort()).toEqual([first, second].sort());
  });

  it('announces one note with a toast that offers Undo', async () => {
    const noteId = await addNote();

    await useAppStore.getState().discardDiffComments({ sessionId: SESSION_ID, ids: [noteId] });

    const toast = useAppStore.getState().undoNotices.at(-1)?.toast;
    expect(toast?.message).toBe('Note discarded');
    expect(toast?.action?.label).toBe('Undo');
  });

  it('does nothing for an id that is not a note of the session', async () => {
    await addNote();

    await useAppStore.getState().discardDiffComments({ sessionId: SESSION_ID, ids: ['ghost'] });

    expect(await storedNotes()).toHaveLength(1);
    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });

  it('moves a note to the branch of the mount that was picked', async () => {
    const noteId = await addNote();
    const mountOf = (id: string, projectId: string, branch: string, parallelIndex: number) => ({
      mountId: id as MountId,
      sessionId: SESSION_ID,
      projectId: projectId as ProjectId,
      mountName: projectId,
      worktreePath: `/wt/${id}`,
      lastWorktreePath: null,
      repoRoot: `/repo/${projectId}`,
      branch,
      baseBranch: 'main',
      parallelIndex,
      isAttached: true,
      diskState: 'present' as const,
      revision: 1,
    });
    useAppStore.setState({
      sessionProjectMounts: {
        [SESSION_ID]: [
          mountOf('mount-ledger', 'project-ledger-core', 'feat/rounding', 0),
          mountOf('mount-relay', 'project-notify-relay', 'feat/retry', 1),
        ],
      },
    });

    await useAppStore.getState().assignDiffComment(SESSION_ID, noteId, 'mount-relay' as MountId);

    expect(useAppStore.getState().diffComments[SESSION_ID]?.[0]).toMatchObject({
      projectId: 'project-notify-relay',
      branch: 'feat/retry',
    });
  });
});
