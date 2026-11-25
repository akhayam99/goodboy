import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { AUTO_STARTING_SENTENCE } from '../../auto/autoStartingSentence';
import { currentTreeStopPort } from '../../auto/treeStopPort';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const endHeldRun = async ({ sessionId, agentId }: Params): Promise<void> => {
  const view = useAppStore
    .getState()
    .autoTreeViews[sessionId]?.find((candidate) => candidate.tree.rootAgentId === agentId);
  if (view === undefined) {
    return;
  }
  const port = currentTreeStopPort();
  if (port === null) {
    throw new Error(AUTO_STARTING_SENTENCE);
  }
  const result = await port({ treeId: view.tree.id });
  if (result !== 'stopped') {
    throw new Error(RUN_ROUTE_COPY.notEnded);
  }
};
