import { useState } from 'react';
import { Ban, Check } from 'lucide-react';
import type { Agent, Session, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { Divider, EmptyState, ScrollFade } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { isWorkflowRunComplete } from '../../../../workflows/isWorkflowRunComplete';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowRailSectionToggle } from './WorkflowRailSectionToggle';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { WorkflowStartButton } from '../../../../workspace/components/WorkspacesSidebar/parts/WorkflowStartButton';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowRailCard } from './WorkflowRailCard';
import { WorkflowRunDetail } from './WorkflowRunDetail';
import { useAgentMetrics } from '../../../hooks/useAgentMetrics';

type Props = {
  readonly session: Session;
};

export const WorkflowsPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId });
  const focusedWorkflowRunId = useAppStore(
    (state) => state.focusedWorkflowRunId[sessionId] ?? null,
  );
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const restoreWorkflow = useAppStore((state) => state.restoreWorkflow);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const agentsByRunId = new Map<string, Agent[]>();
  for (const agent of phaseRuns) {
    if (agent.workflowRunId == null || agent.stepId == null || agent.parentAgentId != null) {
      continue;
    }
    const agents = agentsByRunId.get(agent.workflowRunId) ?? [];
    agents.push(agent);
    agentsByRunId.set(agent.workflowRunId, agents);
  }
  const workflowNameByRunId = new Map(
    attachedRuns.map(({ run, workflow }) => [run.id, workflowKindName(workflow)]),
  );
  const discarded = attachedRuns.filter(({ run }) => run.discardedAt != null);
  const live = attachedRuns.filter(({ run }) => run.discardedAt == null);
  const completed = live.filter(({ run, workflow }) =>
    isWorkflowRunComplete({ run, workflow, agents: agentsByRunId.get(run.id) ?? EMPTY_ARRAY }),
  );
  const active = live.filter((entry) => !completed.includes(entry));
  const focusedRun = attachedRuns.find(({ run }) => run.id === focusedWorkflowRunId) ?? null;
  const hasRuns = attachedRuns.length > 0;
  const hasVisibleRuns =
    active.length > 0 ||
    (showCompleted && completed.length > 0) ||
    (showDiscarded && discarded.length > 0);
  const shouldShowHeaderAttach = hasRuns && (focusedRun != null || hasVisibleRuns);
  const shouldShowEmptyCard = hasRuns && focusedRun == null && !hasVisibleRuns;

  const renderCard = ({ run, workflow }: { run: WorkflowRun; workflow: Workflow }) => {
    const agents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
    const aggregates = agents.map((agent) => aggregatesByAgentId.get(agent.id));
    const isCostTracked = aggregates.some((aggregate) => (aggregate?.turns ?? 0) > 0);
    const costUsd = isCostTracked
      ? aggregates.reduce((total, aggregate) => total + (aggregate?.estimatedCostUsd ?? 0), 0)
      : null;
    const predecessorName = run.chainAfterId
      ? (workflowNameByRunId.get(run.chainAfterId) ?? 'previous')
      : 'previous';
    return (
      <li key={run.id}>
        <WorkflowRailCard
          run={run}
          workflow={workflow}
          agents={agents}
          costUsd={costUsd}
          predecessorName={predecessorName}
          onSelect={() => setFocusedWorkflowRun(sessionId, run.id)}
          onRestore={() => void restoreWorkflow(sessionId, run.id)}
        />
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Workflows
          </h1>
          {hasRuns ? (
            <span className="text-2xs tabular-nums text-muted-foreground/70">
              {attachedRuns.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {focusedRun == null ? (
            <>
              <WorkflowRailSectionToggle
                label="Completed"
                count={completed.length}
                isShown={showCompleted}
                icon={Check}
                onChange={setShowCompleted}
              />
              <WorkflowRailSectionToggle
                label="Discarded"
                count={discarded.length}
                isShown={showDiscarded}
                icon={Ban}
                onChange={setShowDiscarded}
              />
            </>
          ) : null}
          {shouldShowHeaderAttach ? (
            <WorkflowAttachButton sessionId={sessionId} placement="header" />
          ) : null}
        </div>
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1">
        {focusedRun != null ? (
          <WorkflowRunDetail session={session} workflowRunId={focusedRun.run.id} />
        ) : (
          <ScrollFade className="min-w-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 motion-safe:animate-studio-in">
              {!hasRuns ? <WorkflowStartButton sessionId={sessionId} /> : null}
              {shouldShowEmptyCard ? (
                <EmptyState
                  bordered
                  tone={CONCEPT_TONE.workflows}
                  icon={CONCEPT_ICONS.workflows}
                  title="Nothing running"
                  description={
                    completed.length > 0
                      ? 'Every attached workflow is done. Reveal the completed ones to reread them, or attach another.'
                      : 'No live workflow on this session. Attach one to start.'
                  }
                  size="inline"
                  action={<WorkflowAttachButton sessionId={sessionId} placement="header" />}
                />
              ) : null}
              {active.length > 0 ? (
                <ul className="flex flex-col gap-2">{active.map(renderCard)}</ul>
              ) : null}
              {showCompleted && completed.length > 0 ? (
                <ul className="flex flex-col gap-2">{completed.map(renderCard)}</ul>
              ) : null}
              {showDiscarded && discarded.length > 0 ? (
                <ul className="flex flex-col gap-2">{discarded.map(renderCard)}</ul>
              ) : null}
            </div>
          </ScrollFade>
        )}
      </div>
    </div>
  );
};
