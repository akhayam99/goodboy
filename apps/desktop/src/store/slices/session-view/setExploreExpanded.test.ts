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
import { aSession } from '@goodboy/types/testing';
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

const SETTLEMENT = aSession({ goal: 'Settlement rounding' }).id;
const PAYOUTS = aSession({ goal: 'Payout export' }).id;

const LEDGER = '/work/ledger-core';
const NOTIFY = '/work/notify-relay';

const expandedOf = ({ sessionId, mountPath }: { sessionId: SessionId; mountPath: string }) =>
  useAppStore.getState().exploreExpanded[sessionId]?.[mountPath];

describe('setExploreExpanded', () => {
  it('remembers the folders a session opened in a project', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: true,
    });
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps/ledger-core',
      isExpanded: true,
    });
    expect(expandedOf({ sessionId: SETTLEMENT, mountPath: LEDGER })).toEqual({
      apps: true,
      'apps/ledger-core': true,
    });
  });

  it('forgets a folder when it closes, leaving the rest', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: true,
    });
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'docs',
      isExpanded: true,
    });
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: false,
    });
    expect(expandedOf({ sessionId: SETTLEMENT, mountPath: LEDGER })).toEqual({ docs: true });
  });

  it('keeps sessions apart', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: true,
    });
    expect(expandedOf({ sessionId: PAYOUTS, mountPath: LEDGER })).toBeUndefined();
  });

  it('keeps each project of a session apart', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: true,
    });
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: NOTIFY,
      path: 'docs',
      isExpanded: true,
    });
    expect(expandedOf({ sessionId: SETTLEMENT, mountPath: LEDGER })).toEqual({ apps: true });
    expect(expandedOf({ sessionId: SETTLEMENT, mountPath: NOTIFY })).toEqual({ docs: true });
  });

  it('changes nothing when the folder is already in that state', () => {
    const { setExploreExpanded } = useAppStore.getState();
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: true,
    });
    const before = useAppStore.getState().exploreExpanded;
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'apps',
      isExpanded: true,
    });
    setExploreExpanded({
      sessionId: SETTLEMENT,
      mountPath: LEDGER,
      path: 'docs',
      isExpanded: false,
    });
    expect(useAppStore.getState().exploreExpanded).toBe(before);
  });
});
