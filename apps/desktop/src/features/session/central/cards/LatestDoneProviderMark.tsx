import type { Agent } from '@goodboy/types';
import { useAgentModelLine } from '../../../providers/modelLine/AgentModelLine/useAgentModelLine';
import { AgentProviderMark } from '../../components/AgentDetailPane/AgentProviderMark';

type Props = {
  readonly agent: Agent;
};

export const LatestDoneProviderMark = ({ agent }: Props) => {
  const line = useAgentModelLine({ agent });
  return <AgentProviderMark provider={line?.provider ?? null} />;
};
