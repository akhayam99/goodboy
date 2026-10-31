import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useRunView } from '../../AgentTree/useRunView';
import { HintRowStateProvider } from '../HintRowStateProvider';
import { OrchestratedChecklist } from '../OrchestratedChecklist';
import { OrchestratedComposer } from '../OrchestratedComposer';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const HintRowsBody = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  return (
    <HintRowStateProvider>
      <div className="flex min-w-0 flex-col gap-4">
        <OrchestratedChecklist session={session} view={view} />
        <OrchestratedComposer sessionId={session.id} run={run} agents={view.agents} />
      </div>
    </HintRowStateProvider>
  );
};
