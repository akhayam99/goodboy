import type { AgentId, StepId } from '@goodboy/types';
import type { WorkflowRoutingNodeKind } from './types';

type Params = {
  readonly nodeKind: WorkflowRoutingNodeKind;
  readonly id: StepId | AgentId;
};

export const workflowNodeRoutingKey = ({ nodeKind, id }: Params): string => `${nodeKind}:${id}`;
