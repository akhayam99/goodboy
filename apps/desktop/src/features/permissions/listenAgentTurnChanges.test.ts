// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';

type Change =
  | Readonly<{ kind: 'setting'; key: string }>
  | Readonly<{ kind: 'agent-turn'; sessionId: SessionId; agentId: AgentId }>;

const { bus, refreshAgentAsks, drainAgentQueue } = vi.hoisted(() => ({
  bus: new Set<(change: Change) => void>(),
  refreshAgentAsks: vi.fn(async (_params: unknown) => undefined),
  drainAgentQueue: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('../../shared/lib/dataChanged', () => ({
  listenDataChanged: async ({ onChange }: { onChange: (change: Change) => void }) => {
    bus.add(onChange);
    return () => undefined;
  },
}));
vi.mock('../../store', () => ({
  useAppStore: { getState: () => ({ refreshAgentAsks, drainAgentQueue }) },
}));

import { listenAgentTurnChanges } from './listenAgentTurnChanges';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });

describe('listenAgentTurnChanges', () => {
  beforeEach(() => {
    bus.clear();
    refreshAgentAsks.mockClear();
    drainAgentQueue.mockClear();
  });

  it('refreshes the asks of that agent, then lets its queue go on', async () => {
    await listenAgentTurnChanges();

    for (const listener of bus) {
      listener({ kind: 'agent-turn', sessionId: SESSION_ID, agentId: AGENT_ID });
    }

    await vi.waitFor(() => expect(drainAgentQueue).toHaveBeenCalledOnce());
    expect(refreshAgentAsks).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(refreshAgentAsks.mock.invocationCallOrder[0]).toBeLessThan(
      drainAgentQueue.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('leaves a saved setting alone', async () => {
    await listenAgentTurnChanges();

    for (const listener of bus) {
      listener({ kind: 'setting', key: 'theme' });
    }

    expect(refreshAgentAsks).not.toHaveBeenCalled();
  });
});
