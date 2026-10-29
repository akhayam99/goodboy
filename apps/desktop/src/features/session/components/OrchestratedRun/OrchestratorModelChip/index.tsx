import type { Session, WorkflowRun } from '@goodboy/types';
import { RunModelChip } from '../../StartRun/RunModelChip';
import { useOrchestratorModel } from '../useOrchestratorModel';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly isOpen: boolean;
};

export const OrchestratorModelChip = ({ session, run, isOpen }: Props) => {
  const { view, isDeciding } = useOrchestratorModel({ session, run });
  return <RunModelChip model={view} label={view.label} isDisabled={!isOpen || isDeciding} />;
};
