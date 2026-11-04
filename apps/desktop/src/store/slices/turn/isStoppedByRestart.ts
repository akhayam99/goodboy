import { AUTO_RESTING_PHASES } from '@goodboy/db';
import { isAgentStatusSettled } from '@goodboy/core/workflows';
import type { Agent } from '@goodboy/types';
import { autoTreeOfAgent } from '../../../features/auto/autoTreeOfAgent';
import type { AutoTreeView } from '../auto-view/state';

type Params = {
  readonly agent: Pick<Agent, 'id' | 'status' | 'stoppedBy' | 'doneAt'>;
  readonly runs: ReadonlyArray<Pick<Agent, 'parentAgentId' | 'deletedAt' | 'status'>>;
  readonly views: ReadonlyArray<AutoTreeView>;
};

const isRetiredByAuto = ({ agent, views }: Pick<Params, 'agent' | 'views'>): boolean => {
  const found = autoTreeOfAgent({ views, agentId: agent.id });
  if (found?.kind !== 'child') {
    return false;
  }
  const phase = found.view.tree.phase;
  return (
    found.delegation.state === 'settled' ||
    phase === 'stopped' ||
    AUTO_RESTING_PHASES.some((resting) => resting === phase)
  );
};

export const isStoppedByRestart = ({ agent, runs, views }: Params): boolean =>
  agent.status === 'stopped' &&
  agent.stoppedBy === 'app' &&
  agent.doneAt == null &&
  !isRetiredByAuto({ agent, views }) &&
  !runs.some(
    (run) =>
      run.parentAgentId === agent.id &&
      run.deletedAt == null &&
      !isAgentStatusSettled({ status: run.status }),
  );
