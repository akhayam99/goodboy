// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';

type Change =
  | Readonly<{ kind: 'setting'; key: string }>
  | Readonly<{ kind: 'agent-turn'; sessionId: SessionId; agentId: AgentId }>;

const { bus } = vi.hoisted(() => ({
  bus: { handlers: new Set<(change: Change) => void>() },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../shared/lib/dataChanged', () => ({
  announceDataChanged: async () => undefined,
  listenDataChanged: async ({ onChange }: { readonly onChange: (change: Change) => void }) => {
    bus.handlers.add(onChange);
    return () => bus.handlers.delete(onChange);
  },
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { listenAgentTurnChanges } from './listenAgentTurnChanges';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });

let store: StoryStore;
const refreshAgentAsks = vi.fn(async (_params: unknown) => undefined);
const drainAgentQueue = vi.fn(async (_params: unknown) => undefined);

const announce = (change: Change): void => {
  bus.handlers.forEach((handler) => handler(change));
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  bus.handlers.clear();
  refreshAgentAsks.mockClear();
  drainAgentQueue.mockClear();
  store.setState({ refreshAgentAsks, drainAgentQueue });
});

describe('listenAgentTurnChanges', () => {
  it('refreshes the asks of that agent, then lets its queue go on', async () => {
    await listenAgentTurnChanges();

    announce({ kind: 'agent-turn', sessionId: SESSION_ID, agentId: AGENT_ID });

    await vi.waitFor(() => expect(drainAgentQueue).toHaveBeenCalledOnce());
    expect(refreshAgentAsks).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(refreshAgentAsks.mock.invocationCallOrder[0]).toBeLessThan(
      drainAgentQueue.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('leaves a saved setting alone', async () => {
    await listenAgentTurnChanges();

    announce({ kind: 'setting', key: 'theme' });

    expect(refreshAgentAsks).not.toHaveBeenCalled();
  });
});
