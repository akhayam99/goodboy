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
  scope: 'branch',
  branch: 'hl/ledger-export',
  relation: 'closes',
};

let useAppStore: StoryStore;

const storedLinks = () =>
  rowsOf<{ scope: string; branch: string | null }>({
    sql: 'SELECT scope, branch FROM session_external_tasks ORDER BY scope, branch',
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

describe('takeOffSessionExternalTask', () => {
  it('gives the task back to the session when it leaves its last branch', async () => {
    const { linkSessionExternalTask, takeOffSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, TASK);

    await takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK });

    expect(await storedLinks()).toEqual([{ scope: 'session', branch: 'hl/ledger-export' }]);
  });

  it('keeps the other branches and adds no session row', async () => {
    const { linkSessionExternalTask, takeOffSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, TASK);
    await linkSessionExternalTask(SESSION_ID, { ...TASK, branch: 'hl/notify-retry' });

    await takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK });

    expect(await storedLinks()).toEqual([{ scope: 'branch', branch: 'hl/notify-retry' }]);
  });
});
