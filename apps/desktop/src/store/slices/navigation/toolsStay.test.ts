// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
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
    sessions: [aSession({ id: S1 }), aSession({ id: S2 })],
    setCurrentSession: async () => undefined,
    selectAgent: async () => undefined,
  });
  store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
});

const state = () => store.getState();

const TOOLS: ReadonlyArray<readonly [string, DrawerRequest]> = [
  ['Context', { kind: 'context', sessionId: S1, payload: { section: 'goal', view: 'current' } }],
  ['Explore', { kind: 'explore', sessionId: S1, payload: null }],
  ['Scripts', { kind: 'scripts', sessionId: S1, payload: null }],
  ['Agents', { kind: 'spawned', sessionId: S1, payload: null }],
  ['Ask', { kind: 'ask', sessionId: S1, payload: null }],
];

describe('a tool stays open through a move inside its session', () => {
  it.each(TOOLS)(
    'keeps the %s tool across every page, closes it on another session',
    (_name, tool) => {
      state().openDrawer(tool);

      state().navigate({ to: branchPlace({ sessionId: S1, tab: 'files' }) });
      expect(state().drawer).toEqual(tool);
      state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
      expect(state().drawer).toEqual(tool);
      state().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
      expect(state().drawer).toEqual(tool);

      state().navigate({ to: sessionPlace({ sessionId: S2 }) });
      expect(state().drawer).toBeNull();
      state().back();
      expect(state().drawer).toEqual(tool);
    },
  );

  it('lets the Agents tool follow the page instead of the agent it revealed', () => {
    state().openDrawer({ kind: 'spawned', sessionId: S1, payload: { agentId: AGENT } });
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toEqual({ kind: 'spawned', sessionId: S1, payload: null });
  });

  it('closes a reader or an item on a move, whatever tool it was opened from', () => {
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toBeNull();
  });

  it('keeps the tool open on Back and on the Back row to a page that had none', () => {
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    state().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
    const tool: DrawerRequest = { kind: 'spawned', sessionId: S1, payload: null };
    state().openDrawer(tool);
    state().back();
    expect(state().drawer).toEqual(tool);
    state().forward();
    state().upTo({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toEqual(tool);
  });

  it('keeps a tool in the slot and a tool in the chip through a move', () => {
    const explore: DrawerRequest = { kind: 'explore', sessionId: S1, payload: null };
    const ask: DrawerRequest = { kind: 'ask', sessionId: S1, payload: null };
    state().openDrawer(explore);
    state().openDrawer(ask);

    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });

    expect(state().drawer).toEqual(ask);
    expect(state().drawerBack).toEqual(explore);
  });

  it('closes a reader on a move and brings back the tool in its chip', () => {
    const explore: DrawerRequest = { kind: 'explore', sessionId: S1, payload: null };
    state().openDrawer(explore);
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });

    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });

    expect(state().drawer).toEqual(explore);
    expect(state().drawerBack).toBeNull();
  });

  it('drops a reader from the chip on a move', () => {
    const explore: DrawerRequest = { kind: 'explore', sessionId: S1, payload: null };
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });
    state().openDrawer(explore);

    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });

    expect(state().drawer).toEqual(explore);
    expect(state().drawerBack).toBeNull();
  });

  it('empties the slot and the chip on another session', () => {
    state().openDrawer({ kind: 'explore', sessionId: S1, payload: null });
    state().openDrawer({ kind: 'ask', sessionId: S1, payload: null });

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });

    expect(state().drawer).toBeNull();
    expect(state().drawerBack).toBeNull();
  });

  it('does not carry a tool back into another session', () => {
    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    state().openDrawer({ kind: 'spawned', sessionId: S2, payload: null });
    state().back();
    expect(state().drawer).toBeNull();
  });
});

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId({ value: 'tab-harborline-dev' }) },
};

const BROWSER: DrawerRequest = { kind: 'browser', sessionId: S1, payload: null };

describe('a workspace tool stays across every move inside the window', () => {
  it.each([
    ['Terminal', TERMINAL],
    ['Browser', BROWSER],
  ] as const)('keeps %s on another session, on the Board and on Back', (_name, tool) => {
    state().openDrawer(tool);

    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    expect(selectDrawerPanel(state())).toEqual(tool);
    state().navigate({ to: BOARD_PLACE });
    expect(selectDrawerPanel(state())).toEqual(tool);
    state().back();
    expect(selectDrawerPanel(state())).toEqual(tool);
  });

  it('shows Terminal beside a page, and parks it under its own page', () => {
    state().openDrawer(TERMINAL);

    state().openStudio({ studio: { kind: 'inbox', focus: null } });
    expect(selectDrawerPanel(state())).toEqual(TERMINAL);

    state().switchStudio({ studio: { kind: 'terminal', terminalId: null, sessionId: null } });
    expect(selectDrawerPanel(state())).toBeNull();
    expect(state().drawer).toEqual(TERMINAL);
  });

  it('parks a session tool under a page and keeps Terminal in its chip', () => {
    const explore: DrawerRequest = { kind: 'explore', sessionId: S1, payload: null };
    state().openDrawer(TERMINAL);
    state().openDrawer(explore);

    state().openStudio({ studio: { kind: 'inbox', focus: null } });
    expect(selectDrawerPanel(state())).toBeNull();

    state().closeStudio();
    expect(selectDrawerPanel(state())).toEqual(explore);
    expect(state().drawerBack).toEqual(TERMINAL);
  });

  it('brings Terminal out of the chip when a session tool parks on the Board', () => {
    state().openDrawer(TERMINAL);
    state().openDrawer({ kind: 'ask', sessionId: S1, payload: null });

    state().navigate({ to: BOARD_PLACE });

    expect(state().drawer).toEqual(TERMINAL);
    expect(state().drawerBack).toBeNull();
    state().back();
    expect(state().drawer?.kind).toBe('ask');
    expect(state().drawerBack).toEqual(TERMINAL);
  });

  it('closes only the workspace tools when a page panel takes the right side', () => {
    const explore: DrawerRequest = { kind: 'explore', sessionId: S1, payload: null };
    state().openDrawer(explore);
    state().openDrawer(TERMINAL);

    state().closeWorkspaceTools();

    expect(state().drawer).toEqual(explore);
    expect(state().drawerBack).toBeNull();
  });
});
