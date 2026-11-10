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
  it('parks the dock under the page it grew into, and Back brings the dock again', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');
    const { openTerminalOnPage } = await import('./openTerminalOnPage');
    const { selectDrawerPanel } = await import('../../store/slices/drawer/selectDrawerPanel');
    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });
    const terminalId = store.getState().terminalTabs[SESSION_ID]?.[0]?.id;
    if (terminalId === undefined) {
      throw new Error('the terminal tab was not added');
    }

    openTerminalOnPage({ terminalId, sessionId: SESSION_ID });

    expect(store.getState().appStudio?.kind).toBe('terminal');
    expect(selectDrawerPanel(store.getState())).toBeNull();

    store.getState().back();

    expect(store.getState().appStudio).toBeNull();
    expect(selectDrawerPanel(store.getState())).toEqual({
      kind: 'terminal',
      sessionId: SESSION_ID,
      payload: { terminalId },
    });
  });

  it('docks the page on the same tab, beside the place under it', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');
    const { openTerminalOnPage } = await import('./openTerminalOnPage');
    const { dockTerminalPage } = await import('./dockTerminalPage');
    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });
    const terminalId = store.getState().terminalTabs[SESSION_ID]?.[0]?.id;
    if (terminalId === undefined) {
      throw new Error('the terminal tab was not added');
    }
    openTerminalOnPage({ terminalId, sessionId: SESSION_ID });

    dockTerminalPage({ terminalId, sessionId: SESSION_ID });

    expect(store.getState().appStudio).toBeNull();
    expect(store.getState().drawer?.kind).toBe('terminal');
    expect(store.getState().drawerBack).toBeNull();
  });
});
