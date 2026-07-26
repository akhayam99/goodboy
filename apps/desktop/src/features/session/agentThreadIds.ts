import type { Agent } from '@goodboy/types';

export const agentThreadIds = (agent: Agent): ReadonlyArray<string> =>
  agent.sourceThreadIds ?? (agent.sourceThreadId != null ? [agent.sourceThreadId] : []);
