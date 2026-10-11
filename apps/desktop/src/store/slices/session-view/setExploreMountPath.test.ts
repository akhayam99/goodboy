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

const pathOf = (sessionId: SessionId) => useAppStore.getState().exploreMountPath[sessionId];

describe('setExploreMountPath', () => {
  it('remembers the project a session browses', () => {
    useAppStore.getState().setExploreMountPath({ sessionId: SETTLEMENT, mountPath: LEDGER });
    expect(pathOf(SETTLEMENT)).toBe(LEDGER);
  });

  it('keeps sessions apart', () => {
    useAppStore.getState().setExploreMountPath({ sessionId: SETTLEMENT, mountPath: LEDGER });
    expect(pathOf(PAYOUTS)).toBeUndefined();
  });

  it('clears the pick with null', () => {
    const { setExploreMountPath } = useAppStore.getState();
    setExploreMountPath({ sessionId: SETTLEMENT, mountPath: LEDGER });
    setExploreMountPath({ sessionId: SETTLEMENT, mountPath: null });
    expect(pathOf(SETTLEMENT)).toBeNull();
  });

  it('changes nothing when the project is already picked', () => {
    const { setExploreMountPath } = useAppStore.getState();
    setExploreMountPath({ sessionId: SETTLEMENT, mountPath: LEDGER });
    const before = useAppStore.getState().exploreMountPath;
    setExploreMountPath({ sessionId: SETTLEMENT, mountPath: LEDGER });
    expect(useAppStore.getState().exploreMountPath).toBe(before);
  });

  it('never touches where agents write', () => {
    const before = useAppStore.getState().sessionActiveMount;
    useAppStore.getState().setExploreMountPath({ sessionId: SETTLEMENT, mountPath: LEDGER });
    expect(useAppStore.getState().sessionActiveMount).toBe(before);
  });
});
