import { PaneShell } from '@goodboy/ui';
import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { NextActionStrip } from '../../../../workflows/components/NextActionStrip';
import { OrchestratorDock } from '../../../../workflows/components/OrchestratorStrip/OrchestratorDock';
import { RunBody } from '../../AgentTree/RunBody';
import { RunHeader } from '../../AgentTree/RunHeader';
import { useRunView } from '../../AgentTree/useRunView';
import { WorkTimeProvider } from '../../../../workTreeModel/components/WorkTimeProvider';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const WorkflowRunDetail = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  const composer =
    view.isDynamic && !view.isDiscarded ? (
      <OrchestratorDock sessionId={session.id} run={run} agents={view.agents} />
    ) : undefined;

  return (
    <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
      <PaneShell
        scroll="self"
        dock={composer}
        lead={
          view.isDiscarded ? undefined : (
            <NextActionStrip
              sessionId={session.id}
              run={run}
              workflow={workflow}
              subjectAgentId={null}
            />
          )
        }
        header={<RunHeader session={session} view={view} />}
      >
        <RunBody session={session} view={view} />
      </PaneShell>
    </WorkTimeProvider>
  );
};
