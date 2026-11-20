// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarredIssue } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { TEST_NOW, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { restoreUnstarredClosed } from './restoreUnstarredClosed';

let useAppStore: StoryStore;

const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const CLOSED: StarredIssue = {
  workspaceId: HARBORLINE.id,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  container: null,
  title: 'Retried webhooks post a second credit',
  url: 'https://linear.app/harborline/issue/HBL-412',
  state: 'done',
  stateLabel: 'Done',
  starredAt: TEST_NOW,
  refreshedAt: null,
};

const isStarWrite = (args: unknown): boolean =>
  isRecord(args) && String(args.sql).includes('INSERT INTO workspace_starred_issues');

const starWrites = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(
    ([name, args]) => String(name) === 'db_execute' && isStarWrite(args),
  ).length;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ workspaces: [HARBORLINE], currentWorkspaceId: HARBORLINE.id });
});

describe('undoing Unstar closed', () => {
  it('stars the closed issues again', async () => {
    stubStoryInvoke({ db_execute: { rowsAffected: 1, lastInsertId: 0 }, db_select: [] });

    expect(await restoreUnstarredClosed({ workspaceId: HARBORLINE.id, issues: [CLOSED] })).toBe(
      true,
    );

    expect(starWrites()).toBe(1);
  });

  it('keeps the undo and says so when the stars fail to come back', async () => {
    stubStoryInvoke({
      db_execute: (args: unknown) => {
        if (isStarWrite(args)) {
          throw new Error('database is locked');
        }
        return { rowsAffected: 1, lastInsertId: 0 };
      },
      db_select: [],
    });

    expect(await restoreUnstarredClosed({ workspaceId: HARBORLINE.id, issues: [CLOSED] })).toBe(
      false,
    );

    await vi.waitFor(() =>
      expect(useAppStore.getState().notifications.map((notice) => notice.title)).toContain(
        "Couldn't restore the stars",
      ),
    );
  });
});
