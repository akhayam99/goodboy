// @vitest-environment happy-dom
const db = vi.hoisted(() => {
  const heldLoads: Array<() => void> = [];
  return {
    rows: new Map<string, { readonly grid: string; readonly savedAt: number }>(),
    holdLoads: false,
    heldLoads,
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    getSessionDockGrid: vi.fn(async ({ sessionId }: { readonly sessionId: string }) => {
      if (db.holdLoads) {
        await new Promise<void>((resolve) => db.heldLoads.push(resolve));
      }
      return db.rows.get(sessionId)?.grid ?? null;
    }),
    saveSessionDockGrid: vi.fn(
      async ({
        sessionId,
        grid,
        savedAt,
      }: {
        readonly sessionId: string;
        readonly grid: string;
        readonly savedAt: number;
      }) => {
        db.rows.set(sessionId, { grid, savedAt });
      },
    ),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type MountId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { deskStackOf } from '../../../../store/slices/drawer/deskStackOf';
import type { DrawerGrid, OpenDrawer } from '../../../../store/slices/drawer/state';
import { storedDockGridOf } from '../../../../store/slices/drawer/storedDockGrid';
import { watchSessionDockGrid } from './watchSessionDockGrid';

const WS = brandId<WorkspaceId>({ value: 'ws-acme' });
const S1 = brandId<SessionId>({ value: 'session-payments-api' });
const S2 = brandId<SessionId>({ value: 'session-notify-relay' });

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: S1, payload: null };
const AGENT: OpenDrawer = {
  kind: 'transcript',
  sessionId: S1,
  payload: { agentId: brandId<AgentId>({ value: 'agent-implementer' }) },
};
const PR: OpenDrawer = {
  kind: 'pull-request',
  sessionId: S1,
  payload: { mountId: brandId<MountId>({ value: 'mount-payments-api' }), tab: 'checks' },
};

const GRID: DrawerGrid = {
  columns: [[BROWSER]],
  used: ['browser'],
  focus: { at: 'page' },
  widths: {},
  splits: {},
};

let store: StoryStore;
let stop: (() => void) | null = null;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const state = () => store.getState();

const settle = async () => {
  await vi.advanceTimersByTimeAsync(10);
};

const goTo = async ({ sessionId }: { readonly sessionId: SessionId }) => {
  state().navigate({ to: sessionPlace({ sessionId }) });
  await settle();
};

const stack = () => deskStackOf({ top: state().drawer, back: state().drawerBack });

beforeEach(async () => {
  vi.useFakeTimers();
  db.rows.clear();
  db.holdLoads = false;
  db.heldLoads.splice(0, db.heldLoads.length);
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 }), aSession({ id: S2 })],
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
    selectAgent: async () => undefined,
  });
  stop = watchSessionDockGrid({ store, delayMs: 0 });
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

describe('the agent and the pull request saved with the desk', () => {
  it('saves the agent and the pull request inside the row of the session', async () => {
    await goTo({ sessionId: S1 });
    state().setSessionFace({ sessionId: S1, face: 'desk' });
    state().openDrawer(AGENT);
    state().openDrawer(PR);
    await settle();

    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({
      face: 'desk',
      detail: [
        { kind: 'transcript', agentId: 'agent-implementer' },
        { kind: 'pull-request', mountId: 'mount-payments-api', tab: 'checks' },
      ],
    });
  });

  it('reopens the desk of a session with its agent above its pull request', async () => {
    db.rows.set(S1, {
      grid: storedDockGridOf({ grid: GRID, face: 'desk', detail: [AGENT, PR] }),
      savedAt: 1,
    });

    await goTo({ sessionId: S1 });

    expect(state().sessionFace[S1]).toBe('desk');
    expect(stack()?.agent.payload.agentId).toBe('agent-implementer');
    expect(stack()?.pr.payload.tab).toBe('checks');
    expect(
      state()
        .drawerGrid.columns.flat()
        .map((panel) => panel.kind),
    ).toEqual(['browser']);
  });

  it('opens no agent or pull request when the session was left on the overview', async () => {
    db.rows.set(S1, {
      grid: storedDockGridOf({ grid: GRID, face: 'overview', detail: [AGENT, PR] }),
      savedAt: 1,
    });

    await goTo({ sessionId: S1 });

    expect(stack()).toBeNull();
  });

  it('keeps what the user opened while the row was still loading', async () => {
    db.rows.set(S1, {
      grid: storedDockGridOf({ grid: GRID, face: 'desk', detail: [AGENT, PR] }),
      savedAt: 1,
    });
    db.holdLoads = true;

    await goTo({ sessionId: S1 });
    state().openDrawer({ kind: 'scripts', sessionId: S1, payload: null });
    db.heldLoads.splice(0).forEach((release) => release());
    await settle();

    expect(stack()).toBeNull();
    expect(state().drawer?.kind).toBe('scripts');
  });

  it('gives each session its own detail', async () => {
    db.rows.set(S1, {
      grid: storedDockGridOf({ grid: GRID, face: 'desk', detail: [AGENT, PR] }),
      savedAt: 1,
    });
    await goTo({ sessionId: S1 });
    await goTo({ sessionId: S2 });

    expect(db.rows.has(S2)).toBe(false);
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}').detail).toHaveLength(2);
  });
});
