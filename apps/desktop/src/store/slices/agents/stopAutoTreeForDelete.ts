import type { AgentId } from '@goodboy/types';
import { getAutoTreeByRootAgent } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { currentTreeStopPort } from '../../../features/auto/treeStopPort';

type Params = {
  readonly agentId: AgentId;
};

export const stopAutoTreeForDelete = async ({ agentId }: Params): Promise<void> => {
  const tree = await getAutoTreeByRootAgent({ db: tauriDatabase, rootAgentId: agentId });
  if (tree === null || tree.phase === 'finished' || tree.phase === 'stopped') {
    return;
  }
  const port = currentTreeStopPort();
  if (port === null) {
    throw new Error('Auto is not running yet. Delete this agent again in a moment.');
  }
  const result = await port({ treeId: tree.id });
  if (result === 'stuck') {
    throw new Error(
      'Some agents of this Auto tree are still running. Delete this agent again to retry.',
    );
  }
  if (result === 'not_owner') {
    throw new Error('Another window runs this conversation. Delete this agent there.');
  }
};
