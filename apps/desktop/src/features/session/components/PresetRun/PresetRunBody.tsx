import type { Agent, Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useRunView } from '../AgentTree/useRunView';
import { RunOverviewPage } from './RunOverviewPage';
import { RunStepPage } from './RunStepPage';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agent: Agent | null;
  readonly isActive: boolean;
};

export const PresetRunBody = ({ session, run, workflow, agent, isActive }: Props) => {
  const view = useRunView({ session, run, workflow });
  if (agent === null) {
    return <RunOverviewPage session={session} view={view} />;
  }
  return <RunStepPage session={session} view={view} agent={agent} isActive={isActive} />;
};
