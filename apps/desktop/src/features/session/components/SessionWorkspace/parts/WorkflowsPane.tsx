import { useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import type { Agent, Session, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '../../../../../shared/components/LensEmptyState';
import { splitWorkflowRuns } from '../../../../workflows/activeWorkflowRuns';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { WorkflowStartButton } from '../../../../workspace/components/WorkspacesSidebar/parts/WorkflowStartButton';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowRailCard } from './WorkflowRailCard';
import { WorkflowRunDetail } from './WorkflowRunDetail';
import { useAgentMetrics } from '../../../hooks/useAgentMetrics';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { FocusedPane } from '../../../../../shared/components/PaneShell/FocusedPane';
import { WorkSurfaceBackButton } from '../../../../../shared/components/WorkSurfaceBackButton';
import { FiledItemsToggle } from '../../../../../shared/components/FiledItemsToggle';
import { GhostActionButton } from '../../../../../shared/components/GhostActionButton';

type Props = {
  readonly session: Session;
};

export const WorkflowsPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const makeWorkflowPreset = useAppStore((s) => s.makeWorkflowPreset);
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId });
  const focusedWorkflowRunId = useAppStore(
    (state) => state.focusedWorkflowRunId[sessionId] ?? null,
  );
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const restoreWorkflow = useAppStore((state) => state.restoreWorkflow);
  const [showFiled, setShowFiled] = useState(false);
  const { agentsByRunId, discarded, completed, active } = splitWorkflowRuns({
    attachedRuns,
    agents: phaseRuns,
  });
  const workflowNameByRunId = new Map(
    attachedRuns.map(({ run, workflow }) => [run.id, workflowKindName(workflow)]),
  );
  const focusedRun = attachedRuns.find(({ run }) => run.id === focusedWorkflowRunId) ?? null;
  const hasRuns = attachedRuns.length > 0;
  const hasActiveRuns = active.length > 0;
  const shouldShowHeaderAttach = hasRuns && (focusedRun != null || hasActiveRuns);
  const shouldShowEmptyCard = hasRuns && focusedRun == null && !hasActiveRuns;

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

  if (focusedRun != null) {
    return (
      <FocusedPane
        lens="Workflows"
        count={attachedRuns.length}
        actions={
          <>
            <WorkSurfaceBackButton sessionId={sessionId} />
            {focusedRun.workflow != null && focusedRun.workflow.isPreset === false ? (
              <GhostActionButton
                icon={BookmarkPlus}
                label="Make preset"
                title="Keep this configuration in the workspace presets"
                onClick={() =>
                  void makeWorkflowPreset(session.workspaceId, focusedRun.workflow!.id)
                }
              />
            ) : null}
            {shouldShowHeaderAttach ? (
              <WorkflowAttachButton sessionId={sessionId} placement="header" />
            ) : null}
          </>
        }
      >
        <WorkflowRunDetail session={session} workflowRunId={focusedRun.run.id} />
      </FocusedPane>
    );
  }

  return (
    <PaneShell
      title="Workflows"
      description="Sequences of agents this session runs toward its goal."
      meta={hasRuns ? attachedRuns.length : undefined}
      actions={
        shouldShowHeaderAttach ? (
          <WorkflowAttachButton sessionId={sessionId} placement="header" />
        ) : null
      }
    >
      {!hasRuns ? <WorkflowStartButton sessionId={sessionId} /> : null}
      {shouldShowEmptyCard ? (
        <LensEmptyState
          tone={CONCEPT_TONE.workflows}
          icon={CONCEPT_ICONS.workflows}
          title="Nothing running"
          description={
            completed.length > 0
              ? 'Every attached workflow is done. Reveal the completed ones to reread them, or attach another.'
              : 'No live workflow on this session. Attach one to start.'
          }
          action={<WorkflowAttachButton sessionId={sessionId} placement="header" />}
        />
      ) : null}
      {active.length > 0 ? <ul className="flex flex-col gap-2">{active.map(renderCard)}</ul> : null}
      <FiledItemsToggle
        noun="completed"
        items="workflows"
        count={completed.length + discarded.length}
        isShown={showFiled}
        icon={Check}
        onChange={setShowFiled}
      />
      {showFiled && completed.length > 0 ? (
        <ul className="flex flex-col gap-2">{completed.map(renderCard)}</ul>
      ) : null}
      {showFiled && discarded.length > 0 ? (
        <ul className="flex flex-col gap-2">{discarded.map(renderCard)}</ul>
      ) : null}
    </PaneShell>
  );
};
