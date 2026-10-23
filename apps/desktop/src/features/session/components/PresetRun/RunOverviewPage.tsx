import { PaneShell, TERMINAL_DIM, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { RunAddStep } from '../AgentTree/RunAddStep';
import { RunFinishedActions } from '../AgentTree/RunFinishedActions';
import { RunGoal } from '../AgentTree/RunGoal';
import { RunWriteDestination } from '../AgentTree/RunWriteDestination';
import type { RunView } from '../AgentTree/useRunView';
import { OrchestratedFacts } from '../OrchestratedRun/OrchestratedFacts';
import { RunPageActions } from './RunPageActions';
import { RunTail } from './RunTail';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const RunOverviewPage = ({ session, view }: Props) => {
  const { run, workflow, isDiscarded, isCompleted } = view;
  const sessionId = session.id;

  return (
    <PaneShell
      page="run"
      title={view.name}
      actions={<RunPageActions session={session} view={view} stepAgentId={null} />}
      headerRhythm="section"
      animationClassName="motion-safe:animate-fade-in"
    >
      <div
        data-run-overview={run.id}
        className={cn('flex min-w-0 flex-col gap-6', isDiscarded && TERMINAL_DIM)}
      >
        <RunGoal run={run} workflow={workflow} />
        <OrchestratedFacts session={session} view={view} />
        {isDiscarded ? null : <RunWriteDestination sessionId={sessionId} />}
        {isCompleted ? <RunFinishedActions sessionId={sessionId} workflowRunId={run.id} /> : null}
        {isDiscarded ? null : (
          <RunAddStep
            sessionId={sessionId}
            workspaceId={workflow.workspaceId}
            workflowRunId={run.id}
            stepCount={view.stepCount}
            isTriggerHidden
          />
        )}
        <RunTail session={session} view={view} selectedAgentId={null} />
      </div>
    </PaneShell>
  );
};
