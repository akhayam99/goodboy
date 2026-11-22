// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { importStore, resetStoryStore, type StoryStore } from '../../storyHarness';
import { deskStackOf } from './deskStackOf';
import { selectDetailDrawer } from './selectDetailDrawer';
import { selectSlotBack } from './selectSlotBack';
import type { DrawerRequest } from './state';

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

const SESSION_ID = brandId<SessionId>({ value: 'session-northwind' });
const OTHER_SESSION_ID = brandId<SessionId>({ value: 'session-cascadia' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments-api' });

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: SESSION_ID,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'term-payments-api' }) },
};

const BROWSER: DrawerRequest = { kind: 'browser', sessionId: SESSION_ID, payload: null };

const agentOf = ({ id, sessionId = SESSION_ID }: { id: string; sessionId?: SessionId }) =>
  ({
    kind: 'transcript',
    sessionId,
    payload: { agentId: brandId<AgentId>({ value: id }) },
  }) satisfies DrawerRequest;

const PR: DrawerRequest = {
  kind: 'pull-request',
  sessionId: SESSION_ID,
  payload: { mountId: MOUNT_ID, tab: 'checks', check: 'integration-tests' },
};

const SCRIPTS: DrawerRequest = { kind: 'scripts', sessionId: SESSION_ID, payload: null };

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});

const stack = () => {
  const state = store.getState();
  const pair = deskStackOf({ top: state.drawer, back: state.drawerBack });
  return pair === null ? null : { agent: pair.agent.payload.agentId, pr: pair.pr.payload.tab };
};

const toolKinds = () =>
  store
    .getState()
    .drawerGrid.columns.flat()
    .map((panel) => panel.kind);

describe('the detail place on the Desk', () => {
  beforeEach(async () => {
    await resetStoryStore();
    store.setState({
      sessions: [aSession({ id: SESSION_ID }), aSession({ id: OTHER_SESSION_ID })],
      currentSessionId: SESSION_ID,
    });
  });

  it('holds one tool plus the agent and the pull request together', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    store.getState().openDrawer(PR);

    expect(stack()).toEqual({ agent: 'implementer', pr: 'checks' });
    expect(toolKinds()).toEqual(['terminal']);
    expect(selectSlotBack({ state: store.getState() })).toBeNull();
  });

  it('keeps both readers when the pull request opens first', () => {
    store.getState().openDrawer(PR);
    store.getState().openDrawer(agentOf({ id: 'implementer' }));

    expect(stack()).toEqual({ agent: 'implementer', pr: 'checks' });
  });

  it('keeps both readers when another tool opens beside them', () => {
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    store.getState().openDrawer(PR);
    store.getState().openDrawer(BROWSER);

    expect(stack()).toEqual({ agent: 'implementer', pr: 'checks' });
    expect(toolKinds()).toContain('browser');
  });

  it('swaps the agent for another agent and keeps the pull request', () => {
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    store.getState().openDrawer(PR);
    store.getState().openDrawer(agentOf({ id: 'tester' }));

    expect(stack()).toEqual({ agent: 'tester', pr: 'checks' });
  });

  it('switches the pull request tab in place', () => {
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    store.getState().openDrawer(PR);
    store.getState().openDrawer({ ...PR, payload: { mountId: MOUNT_ID, tab: 'conversation' } });

    expect(stack()).toEqual({ agent: 'implementer', pr: 'conversation' });
  });

  it('never stacks an agent of another session', () => {
    store.getState().openDrawer(agentOf({ id: 'stranger', sessionId: OTHER_SESSION_ID }));
    store.getState().openDrawer(PR);

    expect(stack()).toBeNull();
  });

  it('closing the pull request leaves the agent paired with the tool', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    store.getState().openDrawer(PR);

    store.getState().closeDrawerEntry({ entry: store.getState().drawer ?? PR });

    expect(stack()).toBeNull();
    expect(selectDetailDrawer({ state: store.getState() })?.kind).toBe('transcript');
    expect(toolKinds()).toEqual(['terminal']);
  });

  it('closing the agent leaves the pull request', () => {
    store.getState().openDrawer(PR);
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    const agent = store.getState().drawer;
    if (agent === null) {
      throw new Error('The agent should be open');
    }

    store.getState().closeDrawerEntry({ entry: agent });

    expect(selectDetailDrawer({ state: store.getState() })?.kind).toBe('pull-request');
  });

  it('another reader takes the detail place, with the old top in the back chip', () => {
    store.getState().openDrawer(agentOf({ id: 'implementer' }));
    store.getState().openDrawer(PR);
    store.getState().openDrawer(SCRIPTS);

    expect(stack()).toBeNull();
    expect(selectDetailDrawer({ state: store.getState() })?.kind).toBe('scripts');
    expect(selectSlotBack({ state: store.getState() })?.kind).toBe('pull-request');
  });
});
