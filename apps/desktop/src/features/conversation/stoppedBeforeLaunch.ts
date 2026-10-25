import type { ChatTurnOutcome } from './chatTurnOutcome';

export const STOPPED_BEFORE_LAUNCH: ChatTurnOutcome = {
  status: 'failed',
  error: 'Stopped before the provider started.',
};
