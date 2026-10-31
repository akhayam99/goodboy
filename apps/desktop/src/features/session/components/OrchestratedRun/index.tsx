import { PANE_RHYTHM, PaneShell, TERMINAL_DIM, cn } from '@goodboy/ui';
import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { AgentHeader } from '../AgentDetailPane/AgentHeader';
import { RunWorkTime } from '../AgentTree/RunWorkTime';
import { RunWriteDestination } from '../AgentTree/RunWriteDestination';
import { useRunView } from '../AgentTree/useRunView';
import { RunPageActions } from '../PresetRun/RunPageActions';
import { OrchestratedChecklist } from './OrchestratedChecklist';
import { OrchestratedComposer } from './OrchestratedComposer';
import { OrchestratedContinue } from './OrchestratedContinue';
import { HintRowStateProvider } from './HintRowStateProvider';
import { OrchestratedGoal } from './OrchestratedGoal';
import { OrchestratedResult } from './OrchestratedResult';
import { OrchestratedRouting } from './OrchestratedRouting';
import { OrchestratedTail } from './OrchestratedTail';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { PresetChangeAsk } from './PresetChangeAsk';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const OrchestratedRunPage = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  const sessionId = session.id;
  const runningStep =
    view.agents.find((agent) => agent.parentAgentId == null && agent.status === 'running') ?? null;
  const phase = view.orchestrator.state.phase;
  const isDone = phase === 'done';
  const titleMenu = useObjectMenuTrigger({
    target: { kind: 'workflowRun', sessionId, runId: run.id, stepAgentId: runningStep?.id ?? null },
    anchorKey: `workflow-run-title:${run.id}`,
    viewing: { kind: 'workflowRun', id: run.id },
  });
  const composer = view.isDiscarded ? null : isDone || phase === 'blocked' ? (
    <OrchestratedContinue
      key={run.id}
      sessionId={sessionId}
      runId={run.id}
      {...(phase === 'blocked' && { label: ORCHESTRATED_COPY.hintLabel })}
    />
  ) : (
    <OrchestratedComposer sessionId={sessionId} run={run} agents={view.agents} />
  );

  return (
    <HintRowStateProvider>
      <RunWorkTime sessionId={sessionId} workspaceId={session.workspaceId}>
        <PaneShell
          page="run"
          header={
            <AgentHeader
              title={
                <span
                  className="min-w-0 truncate"
                  onContextMenu={titleMenu.onContextMenu}
                  onKeyDown={titleMenu.onKeyDown}
                >
                  {view.name}
                </span>
              }
              actions={
                <RunPageActions
                  session={session}
                  view={view}
                  stepAgentId={runningStep?.id ?? null}
                />
              }
            />
          }
          headerRhythm="section"
          scroll="body"
          animationClassName="motion-safe:animate-fade-in"
          dock={composer}
          dockEdge="space"
        >
          <article
            data-orchestrated-run={run.id}
            aria-label={view.name}
            className={cn(PANE_RHYTHM.groups, 'min-w-0', view.isDiscarded && TERMINAL_DIM)}
          >
            <OrchestratedGoal session={session} view={view} />
            {view.isDiscarded ? null : (
              <RunWriteDestination sessionId={sessionId} workflowRunId={run.id} />
            )}
            <OrchestratedChecklist session={session} view={view} />
            {isDone ? <OrchestratedResult session={session} view={view} /> : null}
            <OrchestratedTail session={session} view={view} />
            {view.isDiscarded ? null : <PresetChangeAsk sessionId={sessionId} run={run} />}
            <OrchestratedRouting sessionId={sessionId} run={run} workflow={workflow} />
          </article>
        </PaneShell>
      </RunWorkTime>
    </HintRowStateProvider>
  );
};
