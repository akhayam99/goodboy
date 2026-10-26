// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { markAgentUnviewed } from '@goodboy/db';
import { brandId, type AgentId, type IsoDateTime, type Session } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { seedColumn, sessionOf } from '../../workspace/testing/sessionColumn';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { SESSION_KIND } from './session';
import { SESSIONS_KIND } from './sessions';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const iso = (value: string) => brandId<IsoDateTime>({ value });

const FINISHED = iso('2026-10-06T09:00:00.000Z');
const SEEN = iso('2026-10-06T10:00:00.000Z');

const unreadSession = sessionOf({ goal: 'Reply to read' });
const readSession = sessionOf({ goal: 'Already read' });
const noRunSession = sessionOf({ goal: 'Nothing ran' });

type AgentParams = {
  readonly session: Session;
  readonly name: string;
  readonly isSeen: boolean;
  readonly finishedAt?: IsoDateTime;
};

const agentOf = ({ session, name, isSeen, finishedAt = FINISHED }: AgentParams) =>
  anAgent({
    id: brandId<AgentId>({ value: `agent-${name}` }),
    sessionId: session.id,
    status: 'completed',
    lastFinishedAt: finishedAt,
    ...(isSeen && { lastViewedAt: SEEN }),
  });

const seed = () => {
  seedColumn({
    store: useAppStore,
    sessions: [unreadSession, readSession, noRunSession],
  });
  useAppStore.setState({
    sessionPhaseRuns: {
      [unreadSession.id]: [agentOf({ session: unreadSession, name: 'unread', isSeen: false })],
      [readSession.id]: [agentOf({ session: readSession, name: 'read', isSeen: true })],
    },
  });
};

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'menu',
  anchorKey: 'sidebar:test',
  viewing: null,
});

const sessionIds = (session: Session): ReadonlyArray<string> => {
  const facts = SESSION_KIND.facts({
    state: useAppStore.getState(),
    target: { kind: 'session', sessionId: session.id },
  });
  if (facts === null) {
    throw new Error('no facts');
  }
  return resolveActions({ definitions: SESSION_KIND.actions, facts }).map((action) => action.id);
};

const run = async ({ session, id }: { readonly session: Session; readonly id: string }) => {
  const facts = SESSION_KIND.facts({
    state: useAppStore.getState(),
    target: { kind: 'session', sessionId: session.id },
  });
  if (facts === null) {
    throw new Error('no facts');
  }
  await SESSION_KIND.actions
    .find((action) => action.id === id)
    ?.run({ facts, env: env(), choice: null });
};

const lastViewedOf = (session: Session): string | undefined =>
  useAppStore.getState().sessionPhaseRuns[session.id]?.[0]?.lastViewedAt;

describe('the unread verbs of a session', () => {
  it('offers Mark as read on a session with a reply to read, and no Mark as unread', () => {
    seed();

    expect(sessionIds(unreadSession)).toContain('session.markRead');
    expect(sessionIds(unreadSession)).not.toContain('session.markUnread');
  });

  it('offers Mark as unread on a session that was read, and no Mark as read', () => {
    seed();

    expect(sessionIds(readSession)).toContain('session.markUnread');
    expect(sessionIds(readSession)).not.toContain('session.markRead');
  });

  it('offers neither on a session where nothing ever finished', () => {
    seed();

    expect(sessionIds(noRunSession)).not.toContain('session.markUnread');
    expect(sessionIds(noRunSession)).not.toContain('session.markRead');
  });

  it('marks a read session unread and clears the stamp in the store and in the database', async () => {
    seed();

    await run({ session: readSession, id: 'session.markUnread' });

    expect(lastViewedOf(readSession)).toBeUndefined();
    expect(markAgentUnviewed).toHaveBeenCalledWith({
      db: expect.anything(),
      id: brandId<AgentId>({ value: 'agent-read' }),
    });
    expect(sessionIds(readSession)).toContain('session.markRead');
  });

  it('marks an unread session read', async () => {
    seed();

    await run({ session: unreadSession, id: 'session.markRead' });

    expect(lastViewedOf(unreadSession)).toBeDefined();
    expect(sessionIds(unreadSession)).toContain('session.markUnread');
  });

  it('keeps the agent you are looking at out of Mark as unread, since it counts as seen', () => {
    seed();
    useAppStore.setState({
      currentSessionId: readSession.id,
      selectedAgentId: { [readSession.id]: brandId<AgentId>({ value: 'agent-read' }) },
    });

    expect(sessionIds(readSession)).not.toContain('session.markUnread');
  });

  it('marks the latest finished agent when the session ran several', async () => {
    seed();
    const earlier = agentOf({ session: readSession, name: 'earlier', isSeen: true });
    const later = agentOf({
      session: readSession,
      name: 'later',
      isSeen: true,
      finishedAt: iso('2026-10-06T09:30:00.000Z'),
    });
    useAppStore.setState({ sessionPhaseRuns: { [readSession.id]: [earlier, later] } });

    await run({ session: readSession, id: 'session.markUnread' });

    const runs = useAppStore.getState().sessionPhaseRuns[readSession.id] ?? [];
    expect(runs.find((agent) => agent.id === earlier.id)?.lastViewedAt).toBeDefined();
    expect(runs.find((agent) => agent.id === later.id)?.lastViewedAt).toBeUndefined();
  });
});

describe('the unread verbs of several sessions', () => {
  const idsOf = (sessions: ReadonlyArray<Session>) => {
    const facts = SESSIONS_KIND.facts({
      state: useAppStore.getState(),
      target: { kind: 'sessions', sessionIds: sessions.map((session) => session.id) },
    });
    if (facts === null) {
      throw new Error('no facts');
    }
    return resolveActions({ definitions: SESSIONS_KIND.actions, facts });
  };

  it('counts the sessions each verb would touch in its label', () => {
    seed();

    const actions = idsOf([unreadSession, readSession, noRunSession]);
    const read = actions.find((action) => action.id === 'sessions.markRead');
    const unread = actions.find((action) => action.id === 'sessions.markUnread');

    expect(read?.label).toBe('Mark as read');
    expect(unread?.label).toBe('Mark as unread');
  });

  it('says the number from two sessions on', () => {
    seed();
    const another = sessionOf({ goal: 'Another reply to read' });
    useAppStore.setState({
      sessions: [...useAppStore.getState().sessions, another],
      sessionPhaseRuns: {
        ...useAppStore.getState().sessionPhaseRuns,
        [another.id]: [agentOf({ session: another, name: 'another', isSeen: false })],
      },
    });

    const read = idsOf([unreadSession, another]).find(
      (action) => action.id === 'sessions.markRead',
    );

    expect(read?.label).toBe('Mark 2 as read');
  });

  it('offers no verb for a selection that has nothing to mark', () => {
    seed();

    expect(idsOf([noRunSession]).map((action) => action.id)).not.toContain('sessions.markRead');
    expect(idsOf([noRunSession]).map((action) => action.id)).not.toContain('sessions.markUnread');
  });

  it('marks the unread ones read and the read ones unread', async () => {
    seed();
    const actions = [unreadSession, readSession, noRunSession];
    const facts = SESSIONS_KIND.facts({
      state: useAppStore.getState(),
      target: { kind: 'sessions', sessionIds: actions.map((session) => session.id) },
    });
    if (facts === null) {
      throw new Error('no facts');
    }

    await SESSIONS_KIND.actions
      .find((action) => action.id === 'sessions.markRead')
      ?.run({ facts, env: env(), choice: null });
    expect(lastViewedOf(unreadSession)).toBeDefined();

    await SESSIONS_KIND.actions
      .find((action) => action.id === 'sessions.markUnread')
      ?.run({ facts, env: env(), choice: null });
    expect(lastViewedOf(readSession)).toBeUndefined();
  });
});
