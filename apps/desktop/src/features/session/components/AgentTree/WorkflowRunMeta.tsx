import type { ReactNode } from 'react';
import { MetaRow } from '@goodboy/ui';
import type {
  Agent,
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { RunTimeLeftLabel } from '../../../workflows/components/RunTimeLeftLabel';
import { useRunTimeLeft } from '../../../workflows/hooks/useRunTimeLeft';

type Props = {
  readonly items: ReadonlyArray<ReactNode>;
  readonly run: WorkflowRun;
  readonly steps: ReadonlyArray<Step>;
  readonly agents: ReadonlyArray<Agent>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly isTimeLeftShown: boolean;
};

export const WorkflowRunMeta = ({
  items,
  run,
  steps,
  agents,
  roleModels,
  sessionProvider,
  sessionEffort,
  isTimeLeftShown,
}: Props) => {
  const timeLeft = useRunTimeLeft({
    run,
    steps,
    agents,
    roleModels,
    sessionProvider,
    sessionEffort,
    isShown: isTimeLeftShown,
  });
  return (
    <MetaRow
      items={timeLeft === null ? items : [...items, <RunTimeLeftLabel timeLeft={timeLeft} />]}
    />
  );
};
