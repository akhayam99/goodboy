import type { AgentStatus, TurnState } from '@goodboy/types';
import { RUNNING_KINDS } from './components/ChatInput/lib';

type Params = {
  readonly turn: TurnState | null;
  readonly status: AgentStatus | null;
};

export const isAgentRunningOf = ({ turn, status }: Params): boolean =>
  turn === null ? status === 'running' : RUNNING_KINDS.has(turn.kind);
