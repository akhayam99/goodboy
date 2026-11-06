// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';

const { announceDataChanged, turnEventsSaved } = vi.hoisted(() => ({
  announceDataChanged: vi.fn(async (_params: unknown) => undefined),
  turnEventsSaved: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/dataChanged', () => ({ announceDataChanged }));
vi.mock('../transcripts/queue', () => ({ turnEventsSaved }));

import { announceAgentTurn } from './announceAgentTurn';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });

describe('announceAgentTurn', () => {
  beforeEach(() => {
    announceDataChanged.mockClear();
  });

  it('tells the other windows only after the events are saved', async () => {
    let save: () => void = () => undefined;
    turnEventsSaved.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          save = () => resolve(undefined);
        }),
    );

    announceAgentTurn({ sessionId: SESSION_ID, agentId: AGENT_ID });
    await Promise.resolve();
    expect(announceDataChanged).not.toHaveBeenCalled();

    save();

    await vi.waitFor(() =>
      expect(announceDataChanged).toHaveBeenCalledWith({
        change: { kind: 'agent-turn', sessionId: SESSION_ID, agentId: AGENT_ID },
      }),
    );
  });
});
