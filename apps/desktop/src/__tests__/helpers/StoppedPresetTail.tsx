import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useRunView } from '../../features/session/components/AgentTree/useRunView';
import { RunTail } from '../../features/session/components/PresetRun/RunTail';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const StoppedPresetTail = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  return <RunTail session={session} view={view} selectedAgentId={null} />;
};
