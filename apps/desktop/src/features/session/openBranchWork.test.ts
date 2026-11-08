// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { openBranchWork } from './openBranchWork';

const SESSION = aSession();
const GROUP_KEY = 'mount:mount-dup';
const MOUNT_PATH = '/work/payments-api/.goodboy/worktrees/fix-duplicate-credit';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ currentWorkspaceId: SESSION.workspaceId, sessions: [SESSION] });
  useAppStore.getState().setArtifactFilter({ sessionId: SESSION.id, filter: 'report' });
});

describe('openBranchWork', () => {
  it('opens All artifacts with the kind filter back on All, so no artifact of the branch hides', () => {
    openBranchWork({
      sessionId: SESSION.id,
      lens: 'plans',
      groupKey: GROUP_KEY,
      mountPath: MOUNT_PATH,
    });

    expect(useAppStore.getState().artifactFilter[SESSION.id]).toBe('all');
  });

  it('leaves the artifact filter alone for the runs and questions pages', () => {
    openBranchWork({
      sessionId: SESSION.id,
      lens: 'workflows',
      groupKey: GROUP_KEY,
      mountPath: MOUNT_PATH,
    });
    openBranchWork({
      sessionId: SESSION.id,
      lens: 'questions',
      groupKey: GROUP_KEY,
      mountPath: MOUNT_PATH,
    });

    expect(useAppStore.getState().artifactFilter[SESSION.id]).toBe('report');
  });
});
