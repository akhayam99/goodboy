import type { AgentId } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import { lingeringTurns } from './lingeringTurns';

type Params = {
  readonly agentId: AgentId;
};

export const stopLingeringTurn = async ({ agentId }: Params): Promise<void> => {
  const runId = lingeringTurns.runOf({ agentId });
  if (runId === undefined) {
    return;
  }
  try {
    await invokeCommand('turn_cancel', { runId });
  } catch (error) {
    console.warn('stopping the process left running after its result failed', error);
  }
};
