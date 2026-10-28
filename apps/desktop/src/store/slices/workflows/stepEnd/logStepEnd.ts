import type { AgentId } from '@goodboy/types';
import { invokeCommand } from '../../../../shared/lib/invokeCommand';

type Params = {
  readonly agentId: AgentId;
  readonly reason: string;
};

export const logStepEnd = ({ agentId, reason }: Params): void => {
  void invokeCommand('log_step_end', { agent: agentId, reason }).catch((error: unknown) => {
    console.warn('writing the step end line to the app log failed', error);
  });
};
