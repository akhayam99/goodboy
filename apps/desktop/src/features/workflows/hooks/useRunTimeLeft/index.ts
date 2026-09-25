import { useContext } from 'react';
import type {
  Agent,
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { runTimeLeft, type RunTimeLeft } from '../../../session/timeline/runTimeLeft';
import { WorkTimeContext } from '../../../workTreeModel/workTimeSource';

type Params = {
  readonly run: WorkflowRun;
  readonly steps: ReadonlyArray<Step>;
  readonly agents: ReadonlyArray<Agent>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly isShown: boolean;
};

export const useRunTimeLeft = ({
  run,
  steps,
  agents,
  roleModels,
  sessionProvider,
  sessionEffort,
  isShown,
}: Params): RunTimeLeft | null => {
  const source = useContext(WorkTimeContext);
  if (source === null || !isShown) {
    return null;
  }
  return runTimeLeft({ run, steps, agents, source, roleModels, sessionProvider, sessionEffort });
};
