import { PANE_RHYTHM, PaneShell, TERMINAL_DIM, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { RunAddStep } from '../AgentTree/RunAddStep';
import { RunWriteDestination } from '../AgentTree/RunWriteDestination';
import type { RunView } from '../AgentTree/useRunView';
import { HintRowStateProvider } from '../OrchestratedRun/HintRowStateProvider';
import { OrchestratedChecklist } from '../OrchestratedRun/OrchestratedChecklist';
import { OrchestratedGoal } from '../OrchestratedRun/OrchestratedGoal';
import { OrchestratedResult } from '../OrchestratedRun/OrchestratedResult';
import { RunPageHead } from '../RunPage/RunPageHead';
import { RunTail } from './RunTail';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const RunOverviewPage = ({ session, view }: Props) => {
  const { run, workflow, isDiscarded, isCompleted } = view;
  const sessionId = session.id;
  const runningStep =
    view.agents.find((agent) => agent.parentAgentId == null && agent.status === 'running') ?? null;

  return (
    <HintRowStateProvider>
      <PaneShell
        page="run"
        header={<RunPageHead session={session} view={view} stepAgentId={runningStep?.id ?? null} />}
        headerRhythm="section"
        animationClassName="motion-safe:animate-fade-in"
      >
        <article
          data-run-overview={run.id}
          aria-label={view.name}
          className={cn(PANE_RHYTHM.groups, 'min-w-0', isDiscarded && TERMINAL_DIM)}
        >
          <OrchestratedGoal session={session} view={view} />
          {isDiscarded ? null : (
            <RunWriteDestination sessionId={sessionId} workflowRunId={run.id} />
          )}
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="w-full min-w-0">
              <OrchestratedChecklist session={session} view={view} />
            </div>
            {isDiscarded ? null : (
              <div data-run-add-step="" className="flex w-full min-w-0">
                <RunAddStep
                  sessionId={sessionId}
                  workspaceId={workflow.workspaceId}
                  workflowRunId={run.id}
                  stepCount={view.stepCount}
                />
              </div>
            )}
          </div>
          {isCompleted ? <OrchestratedResult session={session} view={view} /> : null}
          <RunTail session={session} view={view} selectedAgentId={null} />
        </article>
      </PaneShell>
    </HintRowStateProvider>
  );
};
