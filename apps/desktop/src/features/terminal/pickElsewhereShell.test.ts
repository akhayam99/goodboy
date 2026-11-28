// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';
import { pickElsewhereShell } from './pickElsewhereShell';

const RELAY = brandId<SessionId>({ value: 'session-notify-relay' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
  });
});

describe('picking a shell that runs in another session', () => {
  it('remembers the picked folder and opens that session', () => {
    pickElsewhereShell({
      shell: {
        key: 'elsewhere:relay',
        sessionId: RELAY,
        sessionTitle: 'Drain the queue',
        label: 'Drain the queue · notify-relay',
        path: '/work/notify-relay',
        runningCount: 1,
      },
    });

    expect(store.getState().terminalScopes[RELAY]).toBe('/work/notify-relay');
    expect(store.getState().currentSessionId).toBe(RELAY);
  });
});
