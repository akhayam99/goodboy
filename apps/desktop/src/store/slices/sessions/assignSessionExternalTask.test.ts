import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
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
  scope: 'session',
  branch: 'hl/ledger-export',
  relation: 'closes',
};

let useAppStore: StoryStore;

const storedLinks = () =>
  rowsOf<{ scope: string; branch: string | null; relation: string }>({
    sql: 'SELECT scope, branch, relation FROM session_external_tasks ORDER BY scope, branch',
  });

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

describe('assignSessionExternalTask', () => {
  it('moves a session link onto a branch and keeps its relation', async () => {
    const { linkSessionExternalTask, assignSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, TASK);

    await assignSessionExternalTask({
      sessionId: SESSION_ID,
      task: TASK,
      branch: 'hl/notify-retry',
    });

    expect(await storedLinks()).toEqual([
      { scope: 'branch', branch: 'hl/notify-retry', relation: 'closes' },
    ]);
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toHaveLength(1);
  });

  it('adds a second branch row when the task is already on a branch', async () => {
    const { linkSessionExternalTask, assignSessionExternalTask } = useAppStore.getState();
    const onBranch: SessionExternalTask = { ...TASK, scope: 'branch' };
    await linkSessionExternalTask(SESSION_ID, onBranch);

    await assignSessionExternalTask({
      sessionId: SESSION_ID,
      task: onBranch,
      branch: 'hl/notify-retry',
    });

    expect(await storedLinks()).toEqual([
      { scope: 'branch', branch: 'hl/ledger-export', relation: 'closes' },
      { scope: 'branch', branch: 'hl/notify-retry', relation: 'closes' },
    ]);
  });

  it('is idempotent when the task is already on that branch', async () => {
    const { linkSessionExternalTask, assignSessionExternalTask } = useAppStore.getState();
    const onBranch: SessionExternalTask = { ...TASK, scope: 'branch' };
    await linkSessionExternalTask(SESSION_ID, onBranch);

    await assignSessionExternalTask({
      sessionId: SESSION_ID,
      task: onBranch,
      branch: 'hl/ledger-export',
    });

    expect(await storedLinks()).toHaveLength(1);
  });

  it('keeps the session link when the branch row cannot be written', async () => {
    const { linkSessionExternalTask, assignSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, TASK);

    await expect(
      assignSessionExternalTask({ sessionId: SESSION_ID, task: TASK, branch: '' }),
    ).rejects.toThrow('Pick a branch');

    expect(await storedLinks()).toEqual([
      { scope: 'session', branch: 'hl/ledger-export', relation: 'closes' },
    ]);
  });
});
