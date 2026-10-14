import { formatError } from '@goodboy/ui';
import { agentStatus } from './agentStatus';
import { answerQuestion } from './answerQuestion';
import { delegate } from './delegate';
import { finishTree } from './finishTree';
import type { AgentCommand, BridgeOutcome } from './ports';
import { requestStatus } from './requestStatus';
import type { AgentVerbContext } from './verbContext';

export type ExecuteAgentCommandParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
  isEnabled: boolean;
}>;

export const AGENT_UNAVAILABLE: BridgeOutcome = {
  isOk: false,
  code: 'delegation_unavailable',
  error: 'Handing work to other agents is not available yet.',
};

export const executeAgentCommand = async ({
  ctx,
  command,
  isEnabled,
}: ExecuteAgentCommandParams): Promise<BridgeOutcome> => {
  if (!isEnabled) {
    return AGENT_UNAVAILABLE;
  }
  try {
    switch (command.verb) {
      case 'delegate':
        return await delegate({ ctx, command });
      case 'request-status':
        return await requestStatus({ ctx, command });
      case 'status':
        return await agentStatus({ ctx, command });
      case 'answer':
        return await answerQuestion({ ctx, command });
      case 'finish':
        return await finishTree({ ctx, command });
      default:
        return { isOk: false, error: `unhandled agent command: ${command.verb}` };
    }
  } catch (error) {
    return { isOk: false, error: formatError(error) };
  }
};
