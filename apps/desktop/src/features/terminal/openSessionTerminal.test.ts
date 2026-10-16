import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
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
const OTHER_SESSION_ID = nextSessionId();

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ currentWorkspaceId: WORKSPACE_ID, currentSessionId: SESSION_ID });
});

describe('openSessionTerminal', () => {
  it('adds a session terminal at the worktree and opens it in the drawer', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');

    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });

    const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.cwd).toBe('/wt/ledger-core');
    expect(store.getState().drawer).toEqual({
      kind: 'terminal',
      sessionId: SESSION_ID,
      payload: { terminalId: tabs[0]?.id },
    });
  });

  it('hands the prefill to a new terminal and never writes it into an existing tab', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');

    openSessionTerminal({
      state: store.getState(),
      sessionId: SESSION_ID,
      cwd: '/wt/ledger-core',
      prefill: 'git push origin hl/ledger-rounding',
    });
    const first = store.getState().terminalTabs[SESSION_ID]?.[0];
    expect(first?.prefill).toBe('git push origin hl/ledger-rounding');

    if (first !== undefined) {
      store.getState().setTerminalPrefill({ owner: first.owner, tabId: first.id, prefill: null });
    }
    openSessionTerminal({
      state: store.getState(),
      sessionId: SESSION_ID,
      cwd: '/wt/ledger-core',
      prefill: 'git push origin again',
    });
    const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.prefill).toBeUndefined();
    expect(tabs[1]?.prefill).toBe('git push origin again');
  });

  it('reuses a running terminal at the same worktree instead of adding one', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');

    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });
    store.getState().closeDrawer();
    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });

    expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(1);
    expect(store.getState().drawer?.kind).toBe('terminal');
  });

  it('adds a tab at a worktree that already has a running terminal when fresh is asked', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');

    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });
    openSessionTerminal({
      state: store.getState(),
      sessionId: SESSION_ID,
      cwd: '/wt/ledger-core',
      isFresh: true,
    });

    expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(2);
  });

  it('starts a fresh terminal when the old one at that worktree has exited', async () => {
    const { openSessionTerminal } = await import('./openSessionTerminal');

    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });
    const [first] = store.getState().terminalTabs[SESSION_ID] ?? [];
    store.setState({
      terminalTabs: {
        [SESSION_ID]: first === undefined ? [] : [{ ...first, status: 'exited' }],
      },
    });
    openSessionTerminal({ state: store.getState(), sessionId: SESSION_ID, cwd: '/wt/ledger-core' });

    expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(2);
  });
});

describe('toggleSessionTerminal', () => {
  it('opens the drawer on the active worktree and closes it on the next press', async () => {
    const { toggleSessionTerminal } = await import('./toggleSessionTerminal');
    store.setState({
      sessionBranches: { [SESSION_ID]: 'hl/ledger-rounding' },
    });

    toggleSessionTerminal({});
    await vi.waitFor(() => expect(store.getState().drawer?.kind).toBe('terminal'));
    expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(1);

    toggleSessionTerminal({});
    expect(store.getState().drawer).toBeNull();
    expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(1);
  });

  it('opens the drawer on the workspace folder of a session without a branch', async () => {
    const { toggleSessionTerminal } = await import('./toggleSessionTerminal');
    store.setState({
      sessions: [aSession({ id: OTHER_SESSION_ID, workspaceId: WORKSPACE_ID })],
      currentSessionId: OTHER_SESSION_ID,
      sessionBranches: { [OTHER_SESSION_ID]: '' },
      terminalFolderOverrides: { [WORKSPACE_ID]: '/work/harborline' },
    });

    toggleSessionTerminal({});
    await vi.waitFor(() => expect(store.getState().drawer?.kind).toBe('terminal'));

    expect(store.getState().terminalTabs[OTHER_SESSION_ID]?.[0]?.cwd).toBe('/work/harborline');
  });

  it('drops the open when the session changed while the folder loaded', async () => {
    const { toggleSessionTerminal } = await import('./toggleSessionTerminal');
    store.setState({
      sessions: [aSession({ id: OTHER_SESSION_ID, workspaceId: WORKSPACE_ID })],
      currentSessionId: OTHER_SESSION_ID,
      sessionBranches: { [OTHER_SESSION_ID]: '' },
      terminalFolderOverrides: { [WORKSPACE_ID]: '/work/harborline' },
    });

    toggleSessionTerminal({});
    store.setState({ currentSessionId: SESSION_ID });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.getState().drawer).toBeNull();
  });
});
