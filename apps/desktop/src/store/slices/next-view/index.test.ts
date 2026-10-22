import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

const HARBORLINE = brandId<SessionId>({ value: 'session-harborline' });
const NORTHWIND = brandId<SessionId>({ value: 'session-northwind' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the next view slice', () => {
  it('keeps the open choice of a group per session', () => {
    const { chooseNextGroup } = useAppStore.getState();

    chooseNextGroup({ sessionId: HARBORLINE, groupId: 'ship', isOpen: true });
    chooseNextGroup({ sessionId: HARBORLINE, groupId: 'decide', isOpen: false });
    chooseNextGroup({ sessionId: NORTHWIND, groupId: 'fix', isOpen: true });

    expect(useAppStore.getState().nextGroupChoice).toEqual({
      [HARBORLINE]: { ship: true, decide: false },
      [NORTHWIND]: { fix: true },
    });
  });

  it('notes each subject once, in the order it was first seen', () => {
    const { noteNextSubjects } = useAppStore.getState();

    noteNextSubjects({ sessionId: HARBORLINE, keys: ['branch:home', 'plan:rollout'] });
    const first = useAppStore.getState().nextSeenSubjects;
    noteNextSubjects({ sessionId: HARBORLINE, keys: ['plan:rollout', 'branch:home'] });

    expect(useAppStore.getState().nextSeenSubjects).toBe(first);

    noteNextSubjects({
      sessionId: HARBORLINE,
      keys: ['branch:billing', 'branch:home', 'branch:billing'],
    });

    expect(useAppStore.getState().nextSeenSubjects[HARBORLINE]).toEqual([
      'branch:home',
      'plan:rollout',
      'branch:billing',
    ]);
  });
});
