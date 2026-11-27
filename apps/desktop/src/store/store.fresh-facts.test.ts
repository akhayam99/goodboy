// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';

type BusChange = {
  readonly kind: string;
  readonly sessionId: SessionId;
};

const { bus, invokeAgentMarkUnviewed } = vi.hoisted(() => ({
  invokeAgentMarkUnviewed: vi.fn(async (_params: unknown) => undefined),
  bus: {
    handlers: new Set<(change: BusChange) => void>(),
    announced: new Array<BusChange>(),
  },
}));

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('../features/workflows/workflows', async () => ({
  ...(await import('./storyHarness')).workflowsModuleMock(),
  invokeAgentMarkUnviewed,
}));
vi.mock('../shared/lib/dataChanged', () => ({
  announceDataChanged: async ({ change }: { readonly change: BusChange }) => {
    bus.announced.push(change);
    bus.handlers.forEach((handler) => handler(change));
  },
  listenDataChanged: async ({ onChange }: { readonly onChange: (change: BusChange) => void }) => {
    bus.handlers.add(onChange);
    return () => bus.handlers.delete(onChange);
  },
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from './storyHarness';
import { listenSessionFactChanges } from '../features/session/listenSessionFactChanges';
import { agentHasUnread } from './slices/agents/agentHasUnread';

const SESSION_ID = brandId<SessionId>({ value: 'session-northwind-1' });
const FIRST_ID = brandId<AgentId>({ value: 'agent-ledger-core' });
const SECOND_ID = brandId<AgentId>({ value: 'agent-notify-relay' });
const T2 = brandId<IsoDateTime>({ value: '2026-05-01T11:00:00.000Z' });
const T3 = brandId<IsoDateTime>({ value: '2026-05-01T12:00:00.000Z' });

const agentOf = (overrides: Partial<Agent>): Agent => ({
  id: FIRST_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Agent',
  status: 'completed',
  ...overrides,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  bus.handlers.clear();
  bus.announced.length = 0;
});

afterEach(() => {
  bus.handlers.clear();
});

const runsOf = (): ReadonlyArray<Agent> =>
  useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];

const unreadIds = (): ReadonlyArray<AgentId> =>
  runsOf()
    .filter((agent) => agentHasUnread(agent, false))
    .map((agent) => agent.id);

const seed = (agents: ReadonlyArray<Agent>): void => {
  useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: agents } });
};

const SEEN_CHANGE = { kind: 'agent-seen', sessionId: SESSION_ID };

describe('markAllAgentsSeen', () => {
  it('writes first, then shows the rows as seen, then tells the other windows', async () => {
    seed([agentOf({ lastFinishedAt: T2 })]);
    storySpies.invokeAgentMarkViewed.mockImplementationOnce(async () => {
      expect(unreadIds()).toEqual([FIRST_ID]);
      expect(bus.announced).toEqual([]);
    });

    await useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 });

    expect(unreadIds()).toEqual([]);
    expect(storySpies.invokeAgentMarkViewed).toHaveBeenCalledWith(FIRST_ID, T2);
    expect(bus.announced).toEqual([SEEN_CHANGE]);
  });

  it('never marks a reply newer than the transcript that was rendered', async () => {
    seed([
      agentOf({ lastFinishedAt: T2 }),
      agentOf({ id: SECOND_ID, ordinal: 2, lastFinishedAt: T3 }),
    ]);

    await useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 });

    expect(unreadIds()).toEqual([SECOND_ID]);
    expect(storySpies.invokeAgentMarkViewed).toHaveBeenCalledTimes(1);
    expect(storySpies.invokeAgentMarkViewed).toHaveBeenCalledWith(FIRST_ID, T2);
  });

  it('keeps a newer read boundary that another window saved meanwhile', async () => {
    seed([agentOf({ lastFinishedAt: T2 })]);
    storySpies.invokeAgentMarkViewed.mockImplementationOnce(async () => {
      seed([agentOf({ lastFinishedAt: T2, lastViewedAt: T3 })]);
    });

    await useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 });

    expect(runsOf()[0]?.lastViewedAt).toBe(T3);
  });

  it('keeps a reply that landed while the write ran unread (state changed since)', async () => {
    seed([agentOf({ lastFinishedAt: T2 })]);
    storySpies.invokeAgentMarkViewed.mockImplementationOnce(async () => {
      seed([agentOf({ lastFinishedAt: T3 })]);
    });

    await useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 });

    expect(unreadIds()).toEqual([FIRST_ID]);
  });

  it('keeps the row unread, shows the error and announces nothing when the write fails', async () => {
    seed([agentOf({ lastFinishedAt: T2 })]);
    storySpies.invokeAgentMarkViewed.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 }),
    ).rejects.toThrow('database is locked');

    expect(unreadIds()).toEqual([FIRST_ID]);
    expect(bus.announced).toEqual([]);
  });

  it('reads the stored row again when the outcome is uncertain (outcome uncertain)', async () => {
    seed([agentOf({ lastFinishedAt: T2 })]);
    storySpies.invokeAgentMarkViewed.mockRejectedValueOnce(new Error('request timed out'));
    storySpies.invokeAgentList.mockResolvedValueOnce([
      agentOf({ lastFinishedAt: T2, lastViewedAt: T2 }),
    ]);

    await expect(
      useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 }),
    ).rejects.toThrow('request timed out');

    expect(storySpies.invokeAgentList).toHaveBeenCalledWith(SESSION_ID);
    expect(unreadIds()).toEqual([]);
  });

  it('shows the rows that were saved and keeps the others unread (part succeeded)', async () => {
    seed([
      agentOf({ lastFinishedAt: T2 }),
      agentOf({ id: SECOND_ID, ordinal: 2, lastFinishedAt: T2 }),
    ]);
    storySpies.invokeAgentMarkViewed.mockResolvedValueOnce(undefined);
    storySpies.invokeAgentMarkViewed.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      useAppStore.getState().markAllAgentsSeen({ sessionId: SESSION_ID, seenUpTo: T2 }),
    ).rejects.toThrow('database is locked');

    expect(unreadIds()).toEqual([SECOND_ID]);
    expect(bus.announced).toEqual([SEEN_CHANGE]);
  });
});

describe('a fact written in another window', () => {
  it('reads the open questions of that session again', async () => {
    const loadSessionOpenQuestions = vi.fn(async () => undefined);
    useAppStore.setState({ loadSessionOpenQuestions });
    await listenSessionFactChanges();

    bus.handlers.forEach((handler) => handler({ kind: 'open-question', sessionId: SESSION_ID }));

    expect(loadSessionOpenQuestions).toHaveBeenCalledWith(SESSION_ID);
  });

  it('reads the slack drafts of a session this window holds, and skips one it does not', async () => {
    const loadSessionSlackDrafts = vi.fn(async () => undefined);
    useAppStore.setState({ loadSessionSlackDrafts, sessionSlackDrafts: {} });
    await listenSessionFactChanges();

    bus.handlers.forEach((handler) => handler({ kind: 'slack-draft', sessionId: SESSION_ID }));
    expect(loadSessionSlackDrafts).not.toHaveBeenCalled();

    useAppStore.setState({ sessionSlackDrafts: { [SESSION_ID]: [] } });
    bus.handlers.forEach((handler) => handler({ kind: 'slack-draft', sessionId: SESSION_ID }));
    expect(loadSessionSlackDrafts).toHaveBeenCalledWith(SESSION_ID);
  });

  it('shows the rows another window marked as seen', async () => {
    seed([agentOf({ lastFinishedAt: T2 })]);
    storySpies.invokeAgentList.mockResolvedValueOnce([
      agentOf({ lastFinishedAt: T2, lastViewedAt: T3 }),
    ]);
    await listenSessionFactChanges();
    expect(unreadIds()).toEqual([FIRST_ID]);

    bus.handlers.forEach((handler) => handler({ kind: 'agent-seen', sessionId: SESSION_ID }));

    await vi.waitFor(() => expect(unreadIds()).toEqual([]));
  });

  it('shows a row another window marked as unread', async () => {
    seed([agentOf({ lastFinishedAt: T2, lastViewedAt: T3 })]);
    storySpies.invokeAgentList.mockResolvedValueOnce([agentOf({ lastFinishedAt: T2 })]);
    await listenSessionFactChanges();

    bus.handlers.forEach((handler) => handler({ kind: 'agent-seen', sessionId: SESSION_ID }));

    await vi.waitFor(() => expect(unreadIds()).toEqual([FIRST_ID]));
  });

  it('cannot undo a Mark as unread written here while its read was in flight', async () => {
    let finishRead: (rows: ReadonlyArray<Agent>) => void = () => undefined;
    seed([agentOf({ lastFinishedAt: T2, lastViewedAt: T3 })]);
    storySpies.invokeAgentList.mockReturnValueOnce(
      new Promise<ReadonlyArray<Agent>>((done) => {
        finishRead = done;
      }),
    );
    await listenSessionFactChanges();
    bus.handlers.forEach((handler) => handler({ kind: 'agent-seen', sessionId: SESSION_ID }));

    await useAppStore.getState().markAgentUnviewed({ sessionId: SESSION_ID, agentId: FIRST_ID });
    finishRead([agentOf({ lastFinishedAt: T2, lastViewedAt: T3 })]);
    await vi.waitFor(() => expect(storySpies.invokeAgentList).toHaveBeenCalled());

    expect(unreadIds()).toEqual([FIRST_ID]);
  });

  it('keeps the old rows and reports it when the stored rows cannot be read', async () => {
    const reportError = vi.fn(async () => undefined);
    seed([agentOf({ lastFinishedAt: T2 })]);
    useAppStore.setState({ reportError });
    storySpies.invokeAgentList.mockRejectedValueOnce(new Error('database is locked'));
    await listenSessionFactChanges();

    bus.handlers.forEach((handler) => handler({ kind: 'agent-seen', sessionId: SESSION_ID }));

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(unreadIds()).toEqual([FIRST_ID]);
  });
});
