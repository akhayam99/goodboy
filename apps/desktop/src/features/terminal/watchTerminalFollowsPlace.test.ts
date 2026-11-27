// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/api/path', () => ({ homeDir: async () => '/Users/mock' }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { BOARD_PLACE, sessionPlace } from '../../store/slices/navigation/place';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';
import { workspaceTerminalOwner } from '../../store/slices/terminal/terminalOwner';
import { brandedId } from '../history/testing/brandedId';
import {
  harborline,
  mountOf,
  paymentsApi,
  notifyRelay,
  sessionOf,
} from '../workspace/testing/sessionColumn';
import { watchTerminalFollowsPlace } from './watchTerminalFollowsPlace';

const ledger = sessionOf({ goal: 'Retry the webhook' });
const relaySession = sessionOf({ goal: 'Drain the queue' });
const payments = mountOf({ session: ledger, project: paymentsApi });
const relay = mountOf({ session: relaySession, project: notifyRelay });

const WORKSPACE_SHELL: TerminalTab = {
  id: brandedId<TerminalTabId>({ value: `ws:${harborline.id}::t1` }),
  owner: workspaceTerminalOwner({ workspaceId: harborline.id }),
  title: 'shell',
  cwd: '/Users/mock/harborline',
  status: 'running',
  createdAt: 0,
};

let store: StoryStore;
let stop: (() => void) | null = null;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers();
  await resetStoryStore();
  stubStoryInvoke({
    terminal_open: null,
    terminal_close: null,
    terminal_list_live: [],
    worktree_status: null,
  });
  store.setState({
    workspaces: [harborline],
    currentWorkspaceId: harborline.id,
    projects: [paymentsApi, notifyRelay],
    sessions: [ledger, relaySession],
    sessionProjectMounts: { [ledger.id]: [payments], [relaySession.id]: [relay] },
    terminalTabs: { [`ws:${harborline.id}`]: [WORKSPACE_SHELL] },
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
  });
  store.getState().navigate({ to: BOARD_PLACE });
  store.getState().openDrawer({
    kind: 'terminal',
    sessionId: null,
    payload: { terminalId: WORKSPACE_SHELL.id },
  });
  stop = watchTerminalFollowsPlace({ store });
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

const state = () => store.getState();

const shownTab = (): TerminalTab | null => {
  const entry = selectGridTool({ state: state(), kind: 'terminal' });
  if (entry?.kind !== 'terminal') {
    return null;
  }
  return (
    Object.values(state().terminalTabs)
      .flat()
      .find((tab) => tab.id === entry.payload.terminalId) ?? null
  );
};

const settle = async () => {
  await vi.advanceTimersByTimeAsync(20);
};

describe('the terminal follows where the window is', () => {
  it('starts a shell in the first worktree of a session entered with the terminal open', async () => {
    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();

    const tab = shownTab();
    expect(tab?.owner).toEqual({ kind: 'session', sessionId: ledger.id });
    expect(tab?.cwd).toBe(payments.worktreePath);
  });

  it('brings the same shell back the next time the session is entered', async () => {
    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();
    const first = shownTab();

    state().navigate({ to: BOARD_PLACE });
    await settle();
    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();

    expect(shownTab()?.id).toBe(first?.id);
    expect(state().terminalTabs[ledger.id]).toHaveLength(1);
  });

  it('shows the workspace shell again on Home and keeps the shell of the session running', async () => {
    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();

    state().navigate({ to: BOARD_PLACE });
    await settle();

    expect(shownTab()?.id).toBe(WORKSPACE_SHELL.id);
    expect(state().terminalTabs[ledger.id]?.[0]?.status).toBe('running');
  });

  it('starts a workspace shell when there is none to go back to', async () => {
    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();
    state().closeTerminalTab({
      owner: workspaceTerminalOwner({ workspaceId: harborline.id }),
      tabId: WORKSPACE_SHELL.id,
    });

    state().navigate({ to: BOARD_PLACE });
    await settle();

    expect(shownTab()?.owner).toEqual(workspaceTerminalOwner({ workspaceId: harborline.id }));
  });

  it('opens nothing when the terminal is closed', async () => {
    const entry = selectGridTool({ state: state(), kind: 'terminal' });
    if (entry !== null) {
      state().closeDrawerEntry({ entry });
    }

    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();

    expect(selectGridTool({ state: state(), kind: 'terminal' })).toBeNull();
    expect(state().terminalTabs[ledger.id] ?? []).toHaveLength(0);
  });

  it('never shows the shell of a session the window left while it was starting', async () => {
    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    state().navigate({ to: sessionPlace({ sessionId: relaySession.id }) });
    await settle();

    const tab = shownTab();
    expect(tab?.owner).toEqual({ kind: 'session', sessionId: relaySession.id });
    expect(tab?.cwd).toBe(relay.worktreePath);
  });

  it('drops the late shell of a session folder the window left while it was starting', async () => {
    let release: (cwd: string) => void = () => undefined;
    const gate = new Promise<string>((resolve) => {
      release = resolve;
    });
    stubStoryInvoke({
      terminal_open: null,
      terminal_close: null,
      terminal_list_live: [],
      worktree_status: null,
      scratch_dir_prepare: () => gate,
    });
    store.setState({ sessionBranches: { [ledger.id]: '' } });

    state().navigate({ to: sessionPlace({ sessionId: ledger.id }) });
    await settle();
    state().navigate({ to: BOARD_PLACE });
    await settle();
    release('/scratch/ledger');
    await settle();

    expect(shownTab()?.id).toBe(WORKSPACE_SHELL.id);
    expect(state().terminalTabs[ledger.id] ?? []).toHaveLength(0);
  });
});
