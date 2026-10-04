import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type {
  IsoDateTime,
  ProjectId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
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

const eventKinds = async () =>
  (
    await rowsOf<{ kind: string }>({
      sql: "SELECT kind FROM session_events WHERE kind IN ('issue_linked', 'issue_unlinked') ORDER BY id",
    })
  ).map((row) => row.kind);

const PAYMENTS = 'project-payments-api' as ProjectId;
const STOREFRONT = 'project-storefront-web' as ProjectId;

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

  it('records no link or unlink history while it moves the task back to the session', async () => {
    const { linkSessionExternalTask, takeOffSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, TASK);
    expect(await eventKinds()).toEqual(['issue_linked']);

    await takeOffSessionExternalTask({ sessionId: SESSION_ID, task: TASK });

    expect(await eventKinds()).toEqual(['issue_linked']);
  });

  it('restores session scope when only another project holds a branch for the same id', async () => {
    const { linkSessionExternalTask, takeOffSessionExternalTask } = useAppStore.getState();
    const payments: SessionExternalTask = {
      ...TASK,
      provider: 'github',
      externalId: '42',
      projectId: PAYMENTS,
    };
    const storefront: SessionExternalTask = {
      ...payments,
      projectId: STOREFRONT,
      branch: 'sf/other',
    };
    await linkSessionExternalTask(SESSION_ID, payments);
    await linkSessionExternalTask(SESSION_ID, storefront);

    await takeOffSessionExternalTask({ sessionId: SESSION_ID, task: payments });

    expect(
      await rowsOf<{ project_id: string; scope: string }>({
        sql: 'SELECT project_id, scope FROM session_external_tasks ORDER BY project_id',
      }),
    ).toEqual([
      { project_id: PAYMENTS, scope: 'session' },
      { project_id: STOREFRONT, scope: 'branch' },
    ]);
  });
});
