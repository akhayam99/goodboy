import { PaneShell } from '@goodboy/ui';
import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { AgentHeader } from '../../../../../../features/session/components/AgentDetailPane/AgentHeader';
import { RunWorkTime } from '../../../../../../features/session/components/AgentTree/RunWorkTime';
import { RunWriteDestination } from '../../../../../../features/session/components/AgentTree/RunWriteDestination';
import { useRunView } from '../../../../../../features/session/components/AgentTree/useRunView';
import { OrchestratedChecklist } from '../../../../../../features/session/components/OrchestratedRun/OrchestratedChecklist';
import { OrchestratedComposer } from '../../../../../../features/session/components/OrchestratedRun/OrchestratedComposer';
import { OrchestratedGoal } from '../../../../../../features/session/components/OrchestratedRun/OrchestratedGoal';
import { OrchestratedTail } from '../../../../../../features/session/components/OrchestratedRun/OrchestratedTail';
import { RunPageActions } from '../../../../../../features/session/components/PresetRun/RunPageActions';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const OneFlowRunDocument = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  const sessionId = session.id;
  const runningStep =
    view.agents.find((agent) => agent.parentAgentId == null && agent.status === 'running') ?? null;
  const composer = <OrchestratedComposer sessionId={sessionId} run={run} agents={view.agents} />;
  return (
    <RunWorkTime sessionId={sessionId} workspaceId={session.workspaceId}>
      <PaneShell
        page="run"
        header={
          <AgentHeader
            title={<span className="min-w-0 truncate">{view.name}</span>}
            actions={
              <RunPageActions session={session} view={view} stepAgentId={runningStep?.id ?? null} />
            }
          />
        }
        headerRhythm="section"
        scroll="body"
        dock={composer}
        dockEdge="space"
      >
        <article
          data-orchestrated-run={run.id}
          aria-label={view.name}
          className="flex min-w-0 flex-col gap-6"
        >
          <OrchestratedGoal session={session} view={view} />
          <RunWriteDestination sessionId={sessionId} />
          <OrchestratedChecklist session={session} view={view} />
          <OrchestratedTail session={session} view={view} />
        </article>
      </PaneShell>
    </RunWorkTime>
  );
};
