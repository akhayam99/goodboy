import type { AgentStatus, TurnState } from '@goodboy/types';
import { isAgentRunningOf } from './isAgentRunningOf';

type Params = {
  readonly turn: TurnState | null;
  readonly status: AgentStatus | null;
};

export const isAgentStopInDockOf = ({ turn, status }: Params): boolean =>
  isAgentRunningOf({ turn, status }) || turn?.kind === 'blocked';
