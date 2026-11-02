// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { aSession, anAgent } from '@goodboy/types/testing';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useRailPinned } from './index';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const active = aSession({
  id: brandId<SessionId>({ value: 'session-ledger-core' }),
  workspaceId,
  goal: 'Harborline ledger-core',
});
const idle = aSession({
  id: brandId<SessionId>({ value: 'session-notify-relay' }),
  workspaceId,
  goal: 'Northwind notify-relay',
});
let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(cleanup);

it('shows an unpinned running session and keeps resting sessions in the flyout', () => {
  useAppStore.setState({
    sessions: [idle, active],
    sessionPhaseRuns: { [active.id]: [anAgent({ sessionId: active.id, status: 'running' })] },
  });
  const { result } = renderHook(() => useRailPinned({ workspaceId }));
  expect(result.current.shown.map((session) => session.id)).toEqual([active.id]);
  expect(result.current.all.map((session) => session.id)).toEqual([active.id, idle.id]);
});
