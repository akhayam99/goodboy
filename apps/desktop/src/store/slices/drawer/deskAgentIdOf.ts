import type { AgentId } from '@goodboy/types';
import { deskDetailOf } from './deskDetailOf';

type Params = Parameters<typeof deskDetailOf>[0];

export const deskAgentIdOf = ({ state, sessionId }: Params): AgentId | null => {
  const agent = deskDetailOf({ state, sessionId }).find((entry) => entry.kind === 'transcript');
  return agent?.kind === 'transcript' ? agent.payload.agentId : null;
};
