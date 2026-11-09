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
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { ExploreChangedView } from './types';

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

const CHANGED_VIEW: ExploreChangedView = {
  mountPath: LEDGER,
  mode: 'changed',
  collapsed: { src: true },
};

describe('setExploreChangedView', () => {
  it('remembers the changed only choice and the folders closed in it', () => {
    useAppStore.getState().setExploreChangedView({ sessionId: SETTLEMENT, view: CHANGED_VIEW });

    expect(useAppStore.getState().exploreChangedView[SETTLEMENT]).toEqual(CHANGED_VIEW);
  });

  it('keeps sessions apart', () => {
    useAppStore.getState().setExploreChangedView({ sessionId: SETTLEMENT, view: CHANGED_VIEW });

    expect(useAppStore.getState().exploreChangedView[PAYOUTS]).toBeUndefined();
  });
});
