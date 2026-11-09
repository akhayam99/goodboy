import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ currentWorkspaceId: WORKSPACE_ID, currentSessionId: SESSION_ID });
});

describe('openTerminalOnPage', () => {
  it('empties the slot with its chip when the terminal moves to its page', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');
    const { openTerminalOnPage } = await import('./openTerminalOnPage');
    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });
    const terminalId = store.getState().terminalTabs[SESSION_ID]?.[0]?.id;
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    expect(store.getState().drawerBack?.kind).toBe('terminal');
    if (terminalId === undefined) {
      throw new Error('the terminal tab was not added');
    }

    openTerminalOnPage({ terminalId, sessionId: SESSION_ID });

    expect(store.getState().drawer).toBeNull();
    expect(store.getState().drawerBack).toBeNull();
  });
});
