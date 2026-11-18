// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('lead-permissions slice', () => {
  it('counts each change per workspace and returns the new revision', () => {
    const { markLeadPermissionsChanged } = useAppStore.getState();

    expect(markLeadPermissionsChanged({ workspaceId: HARBORLINE })).toBe(1);
    expect(markLeadPermissionsChanged({ workspaceId: HARBORLINE })).toBe(2);
    expect(markLeadPermissionsChanged({ workspaceId: NORTHWIND })).toBe(1);

    expect(useAppStore.getState().leadPermissionsRevisionByWorkspace).toEqual({
      [HARBORLINE]: 2,
      [NORTHWIND]: 1,
    });
  });
});
