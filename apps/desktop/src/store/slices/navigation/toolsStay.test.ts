// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type OpenQuestionId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import type { TerminalTab, TerminalTabId } from '../../../shared/types/terminal';
import type { DrawerRequest } from '../drawer/state';
import { BOARD_PLACE, agentPlace, branchPlace, sessionPlace } from './place';
import { selectDrawerPanel } from '../drawer/selectDrawerPanel';

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

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const OTHER_WS = brandId<WorkspaceId>({ value: 'ws-northwind' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const S2 = brandId<SessionId>({ value: 'session-notify-relay' });
const AGENT = brandId<AgentId>({ value: 'agent-implementer' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: S1,
    sessions: [aSession({ id: S1, workspaceId: WS }), aSession({ id: S2, workspaceId: WS })],
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
    selectAgent: async () => undefined,
  });
  store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
});

const state = () => store.getState();

const TOOLS: ReadonlyArray<readonly [string, DrawerRequest]> = [
  ['Scripts', { kind: 'scripts', sessionId: S1, payload: null }],
];

describe('a tool stays open through every move', () => {
  it.each(TOOLS)(
    'keeps the %s tool across every page and on another session, bound to where the window is',
    (_name, tool) => {
      state().openDrawer(tool);

      state().navigate({ to: branchPlace({ sessionId: S1, tab: 'files' }) });
      expect(state().drawer).toEqual(tool);
      state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
      expect(state().drawer).toEqual(tool);
      state().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
      expect(state().drawer).toEqual(tool);

      state().navigate({ to: sessionPlace({ sessionId: S2 }) });
      expect(state().drawer).toEqual({ ...tool, sessionId: S2 });
      state().back();
      expect(state().drawer).toEqual(tool);
    },
  );

  it('closes a reader or an item on a move, whatever tool it was opened from', () => {
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toBeNull();
  });

  it('keeps the tool open on Back and on the Back row to a page that had none', () => {
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    state().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
    const tool: DrawerRequest = { kind: 'scripts', sessionId: S1, payload: null };
    state().openDrawer(tool);
    state().back();
    expect(state().drawer).toEqual(tool);
    state().forward();
    state().upTo({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toEqual(tool);
  });

  it('closes a reader on a move and brings back the tool in its chip', () => {
    const explore: DrawerRequest = { kind: 'scripts', sessionId: S1, payload: null };
    state().openDrawer(explore);
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });

    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });

    expect(state().drawer).toEqual(explore);
    expect(state().drawerBack).toBeNull();
  });

  it('drops a reader from the chip on a move', () => {
    const explore: DrawerRequest = { kind: 'scripts', sessionId: S1, payload: null };
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });
    state().openDrawer(explore);

    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });

    expect(state().drawer).toEqual(explore);
    expect(state().drawerBack).toBeNull();
  });

  it('closes the reader and keeps the tool on another session', () => {
    state().openDrawer({ kind: 'scripts', sessionId: S1, payload: null });
    state().openDrawer({
      kind: 'question',
      sessionId: S1,
      payload: { questionId: brandId<OpenQuestionId>({ value: 'question-open' }) },
    });

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });

    expect(state().drawer).toEqual({ kind: 'scripts', sessionId: S2, payload: null });
    expect(state().drawerBack).toBeNull();
  });

  it('carries a tool opened in another session back, bound to the session entered', () => {
    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    state().openDrawer({ kind: 'scripts', sessionId: S2, payload: null });
    state().back();
    expect(state().drawer).toEqual({ kind: 'scripts', sessionId: S1, payload: null });
  });
});

const TERMINAL_ID = brandId<TerminalTabId>({ value: `ws:${WS}::t1` });

const WORKSPACE_SHELL = {
  id: TERMINAL_ID,
  owner: { kind: 'workspace', workspaceId: WS },
  title: 'pnpm dev',
  cwd: null,
  status: 'running',
  createdAt: 0,
} satisfies TerminalTab;

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: TERMINAL_ID },
};

const BROWSER: DrawerRequest = { kind: 'browser', sessionId: S1, payload: null };

const MONITOR: DrawerRequest = { kind: 'monitoring', sessionId: null, payload: null };

const toolKinds = () =>
  state()
    .drawerGrid.columns.flat()
    .map((panel) => panel.kind);

describe('a grid tool belongs to the window', () => {
  beforeEach(() => {
    store.setState({ terminalTabs: { [`ws:${WS}`]: [WORKSPACE_SHELL] } });
  });

  it.each([
    ['Terminal', TERMINAL],
    ['Browser', BROWSER],
    ['Monitor', MONITOR],
  ] as const)('keeps %s open on another session and on the Board', (_name, tool) => {
    state().openDrawer(tool);

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    expect(toolKinds()).toEqual([tool.kind]);
    state().navigate({ to: BOARD_PLACE });
    expect(toolKinds()).toEqual([tool.kind]);
    expect(selectDrawerPanel(state())?.sessionId).toBeNull();
    state().back();
    state().back();
    expect(toolKinds()).toEqual([tool.kind]);
  });

  it('keeps the grid as it was left, sizes and order included', () => {
    state().openDrawer(TERMINAL);
    state().openDrawer(BROWSER);
    state().resizeDockColumn({ kind: 'terminal', width: 420 });
    const left = state().drawerGrid;

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });

    expect(state().drawerGrid.columns).toEqual(left.columns);
    expect(state().drawerGrid.widths).toEqual(left.widths);
  });

  it('keeps a terminal running when the session is left', () => {
    const sessionTerminal = brandId<TerminalTabId>({ value: `${S1}::t1` });
    const tab = {
      id: sessionTerminal,
      owner: { kind: 'session', sessionId: S1 },
      title: 'ledger-core dev',
      cwd: '/work/ledger-core',
      status: 'running',
      createdAt: 1,
    } satisfies TerminalTab;
    store.setState({ terminalTabs: { [S1]: [tab], [`ws:${WS}`]: [WORKSPACE_SHELL] } });
    state().openDrawer({
      kind: 'terminal',
      sessionId: null,
      payload: { terminalId: sessionTerminal },
    });

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    expect(state().terminalTabs[S1]).toEqual([tab]);
    expect(state().drawerGrid.columns.flat()).toEqual([
      { kind: 'terminal', sessionId: null, payload: { terminalId: TERMINAL_ID } },
    ]);
    state().back();

    expect(state().terminalTabs[S1]).toEqual([tab]);
  });

  it('keeps the tools of the Board open in a session and back', () => {
    state().navigate({ to: BOARD_PLACE });
    state().openDrawer(MONITOR);

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    expect(toolKinds()).toEqual(['monitoring']);
    state().back();

    expect(selectDrawerPanel(state())).toEqual(MONITOR);
  });

  it('keeps every tool across a move inside the session', () => {
    state().openDrawer(TERMINAL);
    state().openDrawer(BROWSER);

    state().navigate({ to: branchPlace({ sessionId: S1, tab: 'files' }) });
    state().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });

    expect(toolKinds().sort()).toEqual(['browser', 'terminal']);
  });

  it('shows Terminal beside a page, and parks it under its own page', () => {
    state().openDrawer(TERMINAL);

    state().openStudio({ studio: { kind: 'inbox', focus: null } });
    expect(selectDrawerPanel(state())).toEqual(TERMINAL);

    state().switchStudio({ studio: { kind: 'terminal', terminalId: null, sessionId: null } });
    expect(selectDrawerPanel(state())).toBeNull();
    expect(state().drawer).toEqual(TERMINAL);
  });

  it('parks Monitor under the Monitoring page and brings it back when the page closes', () => {
    state().openDrawer(MONITOR);

    state().openStudio({ studio: { kind: 'monitoring' } });
    expect(selectDrawerPanel(state())).toBeNull();
    expect(state().drawer).toEqual(MONITOR);

    state().closeStudio();
    expect(selectDrawerPanel(state())).toEqual(MONITOR);
  });

  it('leaves the Board tools of a workspace behind when the window switches workspace', async () => {
    state().navigate({ to: BOARD_PLACE });
    state().openDrawer(MONITOR);
    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    stubStoryInvoke({
      budget_rule_list: [],
      budget_alerts_list: [],
      workflow_list: [],
      step_def_list: [],
    });

    await state().setCurrentWorkspace({ id: OTHER_WS });
    state().navigate({ to: BOARD_PLACE });

    expect(state().currentWorkspaceId).toBe(OTHER_WS);
    expect(selectDrawerPanel(state())).toBeNull();
    expect(toolKinds()).toEqual([]);
  });

  it('opens Monitor of the session on the first press after the Board, closes it on the second', () => {
    state().navigate({ to: BOARD_PLACE });
    state().toggleDrawer(MONITOR);
    expect(state().drawer).toEqual(MONITOR);

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    state().toggleDrawer(MONITOR);
    expect(state().drawer).toEqual(MONITOR);
    state().toggleDrawer(MONITOR);
    expect(state().drawer).toBeNull();
  });

  it('keeps Scripts and Terminal beside a page in the dock grid', () => {
    const scripts: DrawerRequest = { kind: 'scripts', sessionId: S1, payload: null };
    state().openDrawer(TERMINAL);
    state().openDrawer(scripts);

    state().openStudio({ studio: { kind: 'inbox', focus: null } });

    expect(selectDrawerPanel(state())).toEqual(scripts);
    expect(toolKinds().flat()).toEqual(expect.arrayContaining(['terminal', 'scripts']));
  });

  it('keeps Terminal and Scripts together on the Board, with Scripts bound to no session', () => {
    state().openDrawer(TERMINAL);
    state().openDrawer({ kind: 'scripts', sessionId: S1, payload: null });

    state().navigate({ to: BOARD_PLACE });

    expect(toolKinds().flat()).toEqual(expect.arrayContaining(['terminal', 'scripts']));
    expect(
      state()
        .drawerGrid.columns.flat()
        .every((panel) => panel.sessionId === null),
    ).toBe(true);
    state().back();
    expect(toolKinds().flat()).toEqual(expect.arrayContaining(['terminal', 'scripts']));
  });
});
