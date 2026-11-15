// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const CHECKED_AT = Date.parse('2026-11-15T10:00:00.000Z');

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(CHECKED_AT);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('refreshGithubConnection', () => {
  it('stamps the time of a gh check that answered', async () => {
    stubStoryInvoke({ gh_status: { mode: 'gh-cli', available: true, user: 'mara-quint' } });

    await useAppStore.getState().refreshGithubConnection({ workspaceId: HARBORLINE });

    expect(useAppStore.getState().githubCheckedAt[HARBORLINE]).toBe(CHECKED_AT);
  });

  it('keeps the last check time when gh fails', async () => {
    useAppStore.setState({ githubCheckedAt: { [HARBORLINE]: CHECKED_AT - 60_000 } });
    stubStoryInvoke({
      gh_status: () => {
        throw new Error('gh is gone');
      },
    });

    await useAppStore.getState().refreshGithubConnection({ workspaceId: HARBORLINE });

    expect(useAppStore.getState().githubCheckedAt[HARBORLINE]).toBe(CHECKED_AT - 60_000);
    expect(useAppStore.getState().githubWorkspaceStatus[HARBORLINE]).toBeNull();
  });
});
