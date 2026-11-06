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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { storedGroupBy } from './storedGroupBy';

const session = aSession({ goal: 'Replay one webhook event' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
  useAppStore.setState({ sessions: [session] });
});

afterEach(() => {
  localStorage.clear();
});

describe('the remembered grouping and the life of a session', () => {
  it('survives an archive and goes with the delete', () => {
    useAppStore.getState().setGroupBy({ sessionId: session.id, groupBy: 'state' });

    useAppStore.getState().evictSession({ sessionId: session.id, mode: 'archive' });
    expect(storedGroupBy.read({ sessionId: session.id })).toBe('state');

    useAppStore.getState().evictSession({ sessionId: session.id, mode: 'delete' });
    expect(storedGroupBy.read({ sessionId: session.id })).toBeNull();
    expect(useAppStore.getState().groupBySession[session.id]).toBeUndefined();
  });
});
