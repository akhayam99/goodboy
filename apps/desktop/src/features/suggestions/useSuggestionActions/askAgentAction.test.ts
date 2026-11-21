// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { askAgentAction } from './askAgentAction';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const agentId = brandId<AgentId>({ value: 'agent-implementer' });

const senderOf = ({
  isDelivered,
  failure,
}: {
  readonly isDelivered: boolean;
  readonly failure: string | null;
}) => vi.fn(async (_params: unknown) => ({ isDelivered, failure }));

describe('askAgentAction', () => {
  it('sends one question to that agent and nothing else', async () => {
    const send = senderOf({ isDelivered: true, failure: null });
    const action = askAgentAction({
      sessionId,
      agentId,
      agentLabel: 'Implementer',
      sendAgentMessage: send,
    });
    expect(action?.label).toBe('Ask');
    await action?.run();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      sessionId,
      turn: expect.objectContaining({ agentId, attachments: [], override: undefined }),
    });
  });

  it('fails with what the queue said, and Retry sends again', async () => {
    const send = senderOf({ isDelivered: false, failure: "The message couldn't be saved." });
    const action = askAgentAction({
      sessionId,
      agentId,
      agentLabel: 'Implementer',
      sendAgentMessage: send,
    });
    expect(action?.failureTitle).toBe("Couldn't ask the Implementer");
    await expect(action?.run()).rejects.toThrow("The message couldn't be saved.");
    await expect(action?.run()).rejects.toThrow("The message couldn't be saved.");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('counts a held message as sent: the queue delivers it when the turn ends', async () => {
    const send = senderOf({ isDelivered: false, failure: null });
    const action = askAgentAction({
      sessionId,
      agentId,
      agentLabel: 'Implementer',
      sendAgentMessage: send,
    });
    await expect(action?.run()).resolves.toBeUndefined();
  });
});
