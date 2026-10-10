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
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const SETTLEMENT = 'session-settlement' as SessionId;
const PAYOUTS = 'session-payouts' as SessionId;

const expandedOf = (sessionId: SessionId) => useAppStore.getState().exploreExpanded[sessionId];

describe('setExploreExpanded', () => {
  it('remembers the folders a session opened', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps', isExpanded: true });
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps/ledger-core', isExpanded: true });
    expect(expandedOf(SETTLEMENT)).toEqual({ apps: true, 'apps/ledger-core': true });
  });

  it('forgets a folder when it closes, leaving the rest', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps', isExpanded: true });
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'docs', isExpanded: true });
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps', isExpanded: false });
    expect(expandedOf(SETTLEMENT)).toEqual({ docs: true });
  });

  it('keeps sessions apart', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps', isExpanded: true });
    expect(expandedOf(PAYOUTS)).toBeUndefined();
  });

  it('changes nothing when the folder is already in that state', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps', isExpanded: true });
    const before = useAppStore.getState().exploreExpanded;
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'apps', isExpanded: true });
    setExploreExpanded({ sessionId: SETTLEMENT, path: 'docs', isExpanded: false });
    expect(useAppStore.getState().exploreExpanded).toBe(before);
  });
});
