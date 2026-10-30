import type { Agent } from '@goodboy/types';
import type { ShownRouting } from '../../auto/executedRoutingOf';
import { AgentModelLine } from './AgentModelLine';
import { useAgentModelLine } from './AgentModelLine/useAgentModelLine';

type Props = {
  readonly agent: Agent;
  readonly routing?: ShownRouting | null;
  readonly className?: string;
};

export const AgentRowModelLine = ({ agent, routing = null, className }: Props) => {
  const line = useAgentModelLine({ agent, routing });
  return <AgentModelLine line={line} {...(className !== undefined && { className })} />;
};
