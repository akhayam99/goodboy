import type { AgentsState } from './state';

export const AGENTS_HOT_KEYS: ReadonlyArray<keyof AgentsState> = [
  'agentTurnState',
  'agentRunHistory',
];
