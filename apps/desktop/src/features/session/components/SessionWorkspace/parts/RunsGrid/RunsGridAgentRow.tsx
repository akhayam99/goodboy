import type { ComponentProps } from 'react';
import type { Agent } from '@goodboy/types';
import { useAgentModelLine } from '../../../../../providers/modelLine/AgentModelLine/useAgentModelLine';
import { RunsGridRow } from './RunsGridRow';

type Props = Omit<ComponentProps<typeof RunsGridRow>, 'modelLine'> & {
  readonly agent: Agent;
};

export const RunsGridAgentRow = ({ agent, ...row }: Props) => {
  const modelLine = useAgentModelLine({ agent });
  return <RunsGridRow {...row} modelLine={modelLine} />;
};
