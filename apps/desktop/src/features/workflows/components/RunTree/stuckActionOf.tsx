import type { ReactNode } from 'react';
import type { Agent } from '@goodboy/types';
import type { RowState } from '../../../workTreeModel/rowState';
import { RunStepKeepWorking } from './RunStepKeepWorking';
import { RunStepSkipAndGoOn } from './RunStepSkipAndGoOn';

type Params = {
  readonly agent: Agent;
  readonly state: RowState;
};

export const stuckActionOf = ({ agent, state }: Params): ReactNode => {
  if (state.reason?.kind === 'notFinished') {
    return <RunStepKeepWorking agent={agent} />;
  }
  if (agent.status === 'blocked' && agent.workflowRunId != null && agent.parentAgentId == null) {
    return <RunStepSkipAndGoOn agent={agent} workflowRunId={agent.workflowRunId} />;
  }
  return null;
};
