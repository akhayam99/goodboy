import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace, listSessionEvents } from '@goodboy/db';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySqlite,
  injectDbFault,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-ledger-export' as SessionId;

const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  url: 'https://linear.app/harborline/issue/HBL-412',
  title: 'Duplicate credit on webhook redelivery',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  scope: 'branch',
  branch: 'hl/ledger-export',
  relation: 'closes',
};

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
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }));
  useAppStore.setState({ sessionExternalTasks: {} });
});

const storedLinks = () =>
  rowsOf<{ scope: string; branch: string | null }>({
    sql: 'SELECT scope, branch FROM session_external_tasks ORDER BY scope, branch',
  });

const seed = async () => {
  await useAppStore.getState().linkSessionExternalTask(SESSION_ID, { ...TASK, scope: 'session' });
  await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
  await useAppStore
    .getState()
    .linkSessionExternalTask(SESSION_ID, { ...TASK, branch: 'hl/notify-retry' });
};

describe('undoable task placements on sqlite', () => {
  it('restores Stop tracking without changing session placements', async () => {
    await seed();
    const task = {
      workspaceId: WORKSPACE_ID,
      provider: TASK.provider,
      externalId: TASK.externalId,
      identifier: TASK.identifier,
      title: TASK.title,
      url: TASK.url,
      createdAt: TASK.createdAt,
    };
    await useAppStore.getState().linkWorkspaceExternalTask({ task });
    await useAppStore.getState().unlinkWorkspaceExternalTask({
      workspaceId: WORKSPACE_ID,
      provider: TASK.provider,
      externalId: TASK.externalId,
    });
    expect(useAppStore.getState().workspaceExternalTasks[WORKSPACE_ID]).toEqual([]);
    await useAppStore.getState().undoLastOperation({});
    expect(useAppStore.getState().workspaceExternalTasks[WORKSPACE_ID]).toEqual([task]);
    expect(await storedLinks()).toHaveLength(3);
  });

  it('leaves a workspace re-link unchanged when Stop tracking is undone', async () => {
    const task = {
      workspaceId: WORKSPACE_ID,
      provider: TASK.provider,
      externalId: TASK.externalId,
      identifier: TASK.identifier,
      title: TASK.title,
      url: TASK.url,
      createdAt: TASK.createdAt,
    };
    await useAppStore.getState().linkWorkspaceExternalTask({ task });
    await useAppStore.getState().unlinkWorkspaceExternalTask({
      workspaceId: WORKSPACE_ID,
      provider: TASK.provider,
      externalId: TASK.externalId,
    });
    await useAppStore
      .getState()
      .linkWorkspaceExternalTask({ task: { ...task, title: 'New title' } });
    expect(await useAppStore.getState().undoLastOperation({})).toBe(false);
    expect(useAppStore.getState().workspaceExternalTasks[WORKSPACE_ID]?.[0]?.title).toBe(
      'New title',
    );
  });

  it('unlinks the session and every branch in one operation and restores all rows', async () => {
    await seed();
    const before = await storedLinks();
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    expect(await storedLinks()).toEqual([]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    await useAppStore.getState().undoLastOperation({});
    expect(await storedLinks()).toEqual(before);
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toHaveLength(3);
  });

  it('snapshots every placement on one durable unlink event', async () => {
    await seed();
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    const events = await rowsOf<{ payload: string }>({
      sql: "SELECT payload_json AS payload FROM session_events WHERE kind = 'issue_unlinked'",
    });
    expect(events).toHaveLength(1);
    const loaded = await listSessionEvents({ db: storySqlite(), sessionId: SESSION_ID });
    expect(
      loaded.find((event) => event.kind === 'issue_unlinked')?.payload?.taskOperation?.before,
    ).toHaveLength(3);
    expect(JSON.parse(events[0]?.payload ?? '{}').taskOperation).toMatchObject({
      id: useAppStore.getState().undoStack[0]?.id,
      before: [
        expect.objectContaining({ scope: 'session' }),
        expect.objectContaining({ scope: 'branch' }),
        expect.objectContaining({ scope: 'branch' }),
      ],
      after: [],
    });
  });

  it('undoes Take off including removal of the session row it created', async () => {
    await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
    await useAppStore.getState().takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK });
    expect(await storedLinks()).toEqual([{ scope: 'session', branch: TASK.branch }]);
    await useAppStore.getState().undoLastOperation({});
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: TASK.branch }]);
  });

  it('preserves an existing session row when undoing Take off', async () => {
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, scope: 'session', title: 'Session title' });
    await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
    await useAppStore.getState().takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK });
    await useAppStore.getState().undoLastOperation({});
    expect(
      useAppStore
        .getState()
        .sessionExternalTasks[SESSION_ID]?.find((row) => row.scope === 'session')?.title,
    ).toBe('Session title');
    expect(await storedLinks()).toHaveLength(2);
  });

  it('refuses Undo after a re-link and explains that nothing changed', async () => {
    await seed();
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    await useAppStore
      .getState()
      .linkSessionExternalTask(SESSION_ID, { ...TASK, branch: 'hl/new-placement' });
    expect(await useAppStore.getState().undoLastOperation({})).toBe(false);
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/new-placement' }]);
    expect(useAppStore.getState().undoStack).toEqual([]);
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toContain(
      're-linked. Nothing changed.',
    );
  });

  it('rolls back all Undo rows and leaves the operation retryable after a failure', async () => {
    await seed();
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    injectDbFault({
      match: /INSERT INTO session_external_tasks/,
      skip: 1,
      message: 'Undo write failed',
    });
    expect(await useAppStore.getState().undoLastOperation({})).toBe(false);
    expect(await storedLinks()).toEqual([]);
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toEqual([]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(await useAppStore.getState().undoLastOperation({})).toBe(true);
  });

  it('leaves every placement in place if Take off fails while creating the session row', async () => {
    await useAppStore.getState().linkSessionExternalTask(SESSION_ID, TASK);
    injectDbFault({ match: /INSERT INTO session_external_tasks/, message: 'Take off failed' });
    await expect(
      useAppStore.getState().takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK }),
    ).rejects.toThrow();
    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: TASK.branch }]);
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toEqual([TASK]);
    expect(useAppStore.getState().undoStack).toEqual([]);
  });

  it('undoes only the last app operation and consumes it once', async () => {
    await seed();
    await useAppStore.getState().takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK });
    await useAppStore
      .getState()
      .unlinkSessionExternalTask(SESSION_ID, TASK.provider, TASK.externalId);
    await useAppStore.getState().undoLastOperation({});
    expect(await storedLinks()).toHaveLength(2);
    await useAppStore.getState().undoLastOperation({});
    expect(await storedLinks()).toHaveLength(3);
    expect(await useAppStore.getState().undoLastOperation({})).toBe(false);
  });
});
