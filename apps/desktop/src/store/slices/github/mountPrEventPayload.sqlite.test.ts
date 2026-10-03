import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
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
import { mountRequestEventPayload } from '../project-mounts/mountRequests';
import { mountPrEventPayload } from './mountPrEventPayload';

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
const MOUNT_ID = 'mount-ledger' as MountId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;
const URL = 'https://github.com/acme/ledger-core/pull/412';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' });
  await insertWorkspace({ db, workspace });
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }));
  useAppStore.setState({
    mountGithub: {
      [MOUNT_ID]: {
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        revision: 0,
        repository: 'acme/ledger-core',
        host: 'github.com',
        branch: 'mq/ledger-export',
        prs: [],
        links: [],
        pr: null,
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
      },
    },
  });
});

describe('a merge from Goodboy', () => {
  it('records one merge event when the merge and the observed transition both report it', async () => {
    const recordOnce = useAppStore.getState().recordSessionEventOnce;
    await recordOnce({
      sessionId: SESSION_ID,
      kind: 'pr_merged',
      payload: mountRequestEventPayload({
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        identity: {
          provider: 'github',
          host: 'github.com',
          repoSlug: 'acme/ledger-core',
          prNumber: 412,
        },
        title: 'Reconcile the ledger export',
        url: URL,
      }),
    });

    await recordOnce({
      sessionId: SESSION_ID,
      kind: 'pr_merged',
      payload: mountPrEventPayload({
        get: useAppStore.getState,
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        number: 412,
      }),
    });

    const events = await rowsOf<{ payload_json: string }>({
      sql: "SELECT payload_json FROM session_events WHERE kind = 'pr_merged'",
    });
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]?.payload_json ?? '{}')).toMatchObject({
      host: 'github.com',
      repository: 'acme/ledger-core',
      number: 412,
    });
  });
});
