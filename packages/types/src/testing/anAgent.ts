import type { Agent } from '../workflow';
import { nextAgentId, nextSessionId } from './testIds';

export const anAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: nextAgentId(),
  sessionId: nextSessionId(),
  ordinal: 0,
  name: 'agent 1',
  status: 'pending',
  ...overrides,
});
