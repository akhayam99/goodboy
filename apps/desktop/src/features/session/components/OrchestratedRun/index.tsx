import { useMemo } from 'react';
import { PaneShell, TERMINAL_DIM, cn } from '@goodboy/ui';
import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { AgentHeader } from '../AgentDetailPane/AgentHeader';
import { RunWorkTime } from '../AgentTree/RunWorkTime';
import { RunWriteDestination } from '../AgentTree/RunWriteDestination';
import { useRunView } from '../AgentTree/useRunView';
import { RunPageActions } from '../PresetRun/RunPageActions';
import { RunRouteLine } from '../RunRoute/RunRouteLine';
import { OrchestratedChecklist } from './OrchestratedChecklist';
import { OrchestratedComposer } from './OrchestratedComposer';
import { OrchestratedContinue } from './OrchestratedContinue';
import { OrchestratedGoal } from './OrchestratedGoal';
import { OrchestratedResult } from './OrchestratedResult';
import { OrchestratedRouting } from './OrchestratedRouting';
import { OrchestratedTail } from './OrchestratedTail';
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
  const isDone = view.orchestrator.state.phase === 'done';
  const route = run.rulesSnapshot?.route;
  const routeTarget = useMemo(
    () => ({ kind: 'plan' as const, sessionId, runId: run.id }),
    [sessionId, run.id],
  );
  const titleMenu = useObjectMenuTrigger({
    target: { kind: 'workflowRun', sessionId, runId: run.id, stepAgentId: runningStep?.id ?? null },
    anchorKey: `workflow-run-title:${run.id}`,
    viewing: { kind: 'workflowRun', id: run.id },
  });
  const composer = view.isDiscarded ? null : isDone ? (
    <OrchestratedContinue key={run.id} sessionId={sessionId} runId={run.id} />
  ) : (
    <OrchestratedComposer sessionId={sessionId} run={run} agents={view.agents} />
  );

  return (
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
                isOrchestrated
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
          className={cn('flex min-w-0 flex-col gap-6', view.isDiscarded && TERMINAL_DIM)}
        >
          {route === undefined || view.isDiscarded ? null : (
            <RunRouteLine
              workspaceId={session.workspaceId}
              target={routeTarget}
              route={route}
              changeCount={run.rulesSnapshot?.planChanges?.length ?? 0}
            />
          )}
          <OrchestratedGoal session={session} view={view} />
          {view.isDiscarded ? null : <RunWriteDestination sessionId={sessionId} />}
          <OrchestratedChecklist session={session} view={view} />
          {isDone ? <OrchestratedResult session={session} view={view} /> : null}
          <OrchestratedTail session={session} view={view} />
          {view.isDiscarded ? null : <PresetChangeAsk sessionId={sessionId} run={run} />}
          <OrchestratedRouting sessionId={sessionId} run={run} workflow={workflow} />
        </article>
      </PaneShell>
    </RunWorkTime>
  );
};
