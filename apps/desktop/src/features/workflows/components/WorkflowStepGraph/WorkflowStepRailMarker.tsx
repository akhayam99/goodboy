import { WorkNode } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { resolveAgentRowState } from '../../../workTreeModel/rowState';
import { rowStateNode } from '../../../workTreeModel/rowStateCopy';

type Props = {
  readonly agent: Agent;
  readonly marker: string;
  readonly hasOpenQuestion: boolean;
};

export const WorkflowStepRailMarker = ({ agent, marker, hasOpenQuestion }: Props) => {
  const node = rowStateNode({
    state: resolveAgentRowState({
      agent,
      isAsking: hasOpenQuestion,
      question: null,
      isReadyStep: false,
    }),
  });
  return (
    <WorkNode
      state={node.state}
      label={node.label}
      mark={{ kind: 'index', value: marker.split('.').at(-1) ?? marker }}
    />
  );
};
