import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useRunView } from '../../../../../features/session/components/AgentTree/useRunView';
import { OrchestratedChecklist } from '../../../../../features/session/components/OrchestratedRun/OrchestratedChecklist';
import { OrchestratedComposer } from '../../../../../features/session/components/OrchestratedRun/OrchestratedComposer';
import { OrchestratedTail } from '../../../../../features/session/components/OrchestratedRun/OrchestratedTail';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const StoppedRunTail = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-6">
      <OrchestratedChecklist session={session} view={view} />
      <OrchestratedTail session={session} view={view} />
      <OrchestratedComposer sessionId={session.id} run={run} agents={view.agents} />
    </div>
  );
};
