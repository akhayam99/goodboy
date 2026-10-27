// @vitest-environment happy-dom

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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { markAgentUnviewed } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const OTHER_SESSION = brandId<SessionId>({ value: 'session-northwind' });
const SEEN = brandId<AgentId>({ value: 'agent-seen' });
const FRESH = brandId<AgentId>({ value: 'agent-fresh' });
const ELSEWHERE = brandId<AgentId>({ value: 'agent-elsewhere' });

const viewed = brandId<IsoDateTime>({ value: '2026-10-06T10:00:00.000Z' });

type AgentParams = {
  readonly id: AgentId;
  readonly sessionId: SessionId;
  readonly isSeen: boolean;
};

const agentOf = ({ id, sessionId, isSeen }: AgentParams) =>
  anAgent({
    id,
    sessionId,
    status: 'completed',
    lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-06T09:00:00.000Z' }),
    ...(isSeen && { lastViewedAt: viewed }),
  });

beforeEach(async () => {
  await resetStoryStore();
  vi.mocked(markAgentUnviewed).mockClear();
  useAppStore.setState({
    sessionPhaseRuns: {
      [SESSION]: [
        agentOf({ id: SEEN, sessionId: SESSION, isSeen: true }),
        agentOf({ id: FRESH, sessionId: SESSION, isSeen: false }),
      ],
      [OTHER_SESSION]: [agentOf({ id: ELSEWHERE, sessionId: OTHER_SESSION, isSeen: true })],
    },
  });
});

const runsOf = (sessionId: SessionId): ReadonlyArray<Agent> =>
  useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];

const unview = ({
  sessionId,
  agentId,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
}) => useAppStore.getState().markAgentUnviewed({ sessionId, agentId });

describe('markAgentUnviewed', () => {
  it('clears the viewed stamp of the named agent in the database, then in the store', async () => {
    await unview({ sessionId: SESSION, agentId: SEEN });

    expect(markAgentUnviewed).toHaveBeenCalledWith({ db: expect.anything(), id: SEEN });
    expect(runsOf(SESSION).find((agent) => agent.id === SEEN)?.lastViewedAt).toBeUndefined();
  });

  it('touches no other agent and no other session', async () => {
    await unview({ sessionId: SESSION, agentId: SEEN });

    expect(runsOf(OTHER_SESSION)[0]?.lastViewedAt).toBe(viewed);
    expect(runsOf(SESSION).find((agent) => agent.id === FRESH)).toBeDefined();
  });

  it('does nothing for an agent that was never viewed, so the unread one stays as it is', async () => {
    await unview({ sessionId: SESSION, agentId: FRESH });

    expect(markAgentUnviewed).not.toHaveBeenCalled();
  });

  it('does nothing for an agent that is not in that session', async () => {
    await unview({ sessionId: OTHER_SESSION, agentId: SEEN });

    expect(markAgentUnviewed).not.toHaveBeenCalled();
    expect(runsOf(SESSION).find((agent) => agent.id === SEEN)?.lastViewedAt).toBe(viewed);
  });

  it('leaves the stamp in place and reports the failure when the database write fails', async () => {
    vi.mocked(markAgentUnviewed).mockRejectedValueOnce(new Error('disk full'));

    await expect(unview({ sessionId: SESSION, agentId: SEEN })).rejects.toThrow('disk full');

    expect(runsOf(SESSION).find((agent) => agent.id === SEEN)?.lastViewedAt).toBe(viewed);
  });

  it('can be retried after a failure, since nothing was applied', async () => {
    vi.mocked(markAgentUnviewed).mockRejectedValueOnce(new Error('disk full'));
    await expect(unview({ sessionId: SESSION, agentId: SEEN })).rejects.toThrow();

    await unview({ sessionId: SESSION, agentId: SEEN });

    expect(runsOf(SESSION).find((agent) => agent.id === SEEN)?.lastViewedAt).toBeUndefined();
  });
});
