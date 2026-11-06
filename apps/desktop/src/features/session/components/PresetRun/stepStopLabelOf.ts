import type { Agent, Workflow } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { agentKindPalette, classifyAgent } from '../../agent-kind';
import { stepNumberOf } from './stepNumberOf';

type Params = {
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
  readonly workflow: Workflow;
};

type StepCopy = Readonly<{
  stopLabel?: string;
  liveSentence?: string;
}>;

export const stepStopLabelOf = ({ agent, stepAgent, workflow }: Params): StepCopy => {
  if (stepAgent === null || stepAgent.id !== agent.id) {
    return {};
  }
  const number = stepNumberOf({ workflow, agent: stepAgent });
  if (number === null) {
    return { stopLabel: NAMES.stopReply };
  }
  const noun = agentKindPalette({ kind: classifyAgent({ agent, override: null }) }).label;
  return { stopLabel: NAMES.stopReply, liveSentence: `${noun} running step ${number}` };
};
