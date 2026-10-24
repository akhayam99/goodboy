// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime, type SearchQuery } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createReplyRuns } from './createReplyRuns';
import { createSimulatedSend } from './createSimulatedSend';
import { createSimulatedSpawn } from './createSimulatedSpawn';
import { installDemoContext } from './installDemoContext';
import { installDemoMonitor } from './installDemoMonitor';
import { installDemoSearch } from './installDemoSearch';
import { isDemoShortcutCommand } from './isDemoShortcutCommand';
import { isDemoThemeMessage } from './isDemoThemeMessage';
import { isEmptyRead } from './isEmptyRead';
import { DEMO_PROTOCOL } from './demoProtocol';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const AT = brandId<IsoDateTime>({ value: '2026-10-16T15:00:00.000Z' });
const session = aSession({ goal: 'Stop retried webhooks posting a second credit' });
const agent = anAgent({ sessionId: session.id, name: 'Implementer', kind: 'implementer' });

const QUERY: SearchQuery = {
  text: 'credit',
  kinds: [],
  workspaceId: null,
  sessionId: null,
  projectIds: [],
  providers: [],
  statuses: [],
  after: null,
  before: null,
  archived: 'exclude',
  limit: 40,
};

describe('the demo search', () => {
  it('finds a session by its goal and a visitor message by its text', async () => {
    store.setState({
      sessions: [session],
      sessionPhaseRuns: { [session.id]: [agent] },
      transcripts: {
        [agent.id]: [
          {
            kind: 'user_text',
            runId: brandId({ value: 'demo-search-run' }),
            text: 'Please log the credit event id when a duplicate is skipped.',
            at: AT,
          },
        ],
      },
    });
    installDemoSearch({ store });
    const hits = await store.getState().runSearch({ query: QUERY });
    expect(hits.map((hit) => hit.kind)).toEqual(['session', 'message']);
    expect(hits[1]?.snippet.some((segment) => segment.isMatch)).toBe(true);
    expect(
      await store.getState().runSearch({ query: { ...QUERY, kinds: ['message'] } }),
    ).toHaveLength(1);
    expect(await store.getState().runSearch({ query: { ...QUERY, text: 'nothing here' } })).toEqual(
      [],
    );
  });
});

describe('the quiet studios', () => {
  it('answers the Impact aggregates and the starred issues with an empty read', () => {
    const impact = `SELECT COUNT(*) AS count FROM open_questions q JOIN sessions s ON s.id = q.session_id
      WHERE s.workspace_id = ?`;
    expect(isEmptyRead({ sql: impact })).toBe(true);
    expect(
      isEmptyRead({ sql: 'SELECT * FROM workspace_starred_issues WHERE workspace_id = ?' }),
    ).toBe(true);
  });

  it('never answers a read that loads the sessions themselves', () => {
    expect(isEmptyRead({ sql: 'SELECT * FROM sessions WHERE workspace_id = ?' })).toBe(false);
    expect(
      isEmptyRead({
        sql: 'SELECT s.* FROM sessions s WHERE s.workspace_id = ? ORDER BY s.created_at',
      }),
    ).toBe(false);
    expect(isEmptyRead({ sql: 'SELECT * FROM telemetry_records WHERE session_id = ?' })).toBe(
      false,
    );
  });

  it('marks a session context as loaded and leaves a loaded one alone', () => {
    store.setState({
      sessions: [session],
      sessionSlotsLoad: {},
      sessionSlots: {},
    });
    installDemoContext({ store });
    expect(store.getState().sessionSlotsLoad[session.id]).toBe('loaded');
    expect(store.getState().sessionSlots[session.id]?.[0]?.value).toBe(session.goal);
    expect(store.getState().sessionDecisions[session.id]).toEqual([]);
    store.setState({
      sessionSlots: { [session.id]: [{ key: 'goal', value: 'Kept', enabled: true }] },
    });
    installDemoContext({ store });
    expect(store.getState().sessionSlots[session.id]?.[0]?.value).toBe('Kept');
  });

  it('gives Monitoring a calm snapshot once', () => {
    store.setState({ monitorSnapshot: null });
    installDemoMonitor({ store });
    const snapshot = store.getState().monitorSnapshot;
    expect(snapshot?.isPlatformSupported).toBe(true);
    installDemoMonitor({ store });
    expect(store.getState().monitorSnapshot).toBe(snapshot);
  });
});

describe('a simulated spawn', () => {
  it('starts an agent that answers, instead of waiting on the database', async () => {
    store.setState({ sessions: [session], sessionPhaseRuns: { [session.id]: [] } });
    const spawn = createSimulatedSpawn({
      store,
      send: createSimulatedSend({
        store,
        reply: 'On it.',
        now: () => AT,
        shouldClearDraft: false,
        runs: createReplyRuns(),
      }),
      now: () => AT,
    });
    const agentId = await spawn(session.id, {
      kindOverride: 'reviewer',
      initialPrompt: 'Review the changes',
      focus: 'none',
    });
    const [spawned] = store.getState().sessionPhaseRuns[session.id] ?? [];
    expect(spawned?.id).toBe(agentId);
    expect(spawned?.kind).toBe('reviewer');
    expect(spawned?.status).toBe('running');
    await vi.advanceTimersByTimeAsync(10000);
    const events = store.getState().transcripts[agentId] ?? [];
    expect(events.some((event) => event.kind === 'user_text')).toBe(true);
    expect(events.some((event) => event.kind === 'done')).toBe(true);
  });
});

describe('the frame messages', () => {
  const envelope = {
    channel: DEMO_PROTOCOL.channel,
    version: DEMO_PROTOCOL.version,
    generation: 0,
  };

  it('accepts a theme message only with a known theme', () => {
    expect(isDemoThemeMessage({ ...envelope, type: 'theme', theme: 'light' })).toBe(true);
    expect(isDemoThemeMessage({ ...envelope, type: 'theme', theme: 'sepia' })).toBe(false);
    expect(isDemoThemeMessage({ ...envelope, type: 'play', theme: 'light' })).toBe(false);
    expect(isDemoThemeMessage({ type: 'theme', theme: 'light' })).toBe(false);
  });

  it('accepts a shortcut command only for the palette, find and sidebar keys', () => {
    expect(isDemoShortcutCommand({ ...envelope, type: 'shortcut', code: 'KeyK' })).toBe(true);
    expect(isDemoShortcutCommand({ ...envelope, type: 'shortcut', code: 'KeyW' })).toBe(false);
    expect(isDemoShortcutCommand({ ...envelope, type: 'shortcut' })).toBe(false);
  });
});
