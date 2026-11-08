import { answerQuestion } from './answerQuestion';
import { delegate } from './delegate';
import { finishTree } from './finishTree';
import type { AgentCommand, BridgeOutcome } from './ports';
import { releaseDelegation } from './returns/releaseDelegation';
import { messageChild } from './talk/messageChild';
import { stopChild } from './talk/stopChild';
import type { AgentVerbContext } from './verbContext';

export type RunAutoCommandParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

export const runAutoCommand = async ({
  ctx,
  command,
}: RunAutoCommandParams): Promise<BridgeOutcome> => {
  switch (command.verb) {
    case 'delegate':
      return delegate({ ctx, command });
    case 'propose':
      return delegate({ ctx, command, isProposal: true });
    case 'answer':
      return answerQuestion({ ctx, command });
    case 'release':
      return releaseDelegation({ ctx, command });
    case 'message':
      return messageChild({ ctx, command });
    case 'stop':
      return stopChild({ ctx, command });
    case 'finish':
      return finishTree({ ctx, command });
    default:
      return { isOk: false, error: `unhandled auto command: ${command.verb}` };
  }
};
