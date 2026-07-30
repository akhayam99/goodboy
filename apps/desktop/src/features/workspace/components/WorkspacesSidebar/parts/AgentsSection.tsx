import { SectionHeader, cn } from '@goodboy/ui';
import type { Session, WorkflowRunId } from '@goodboy/types';
import { ScriptsSection } from '../../../../scripts/components/ScriptsSection';
import { DogMascot } from '../../../../../shared/components/DogMascot';
import { SECTION_ICONS } from '../../../../../shared/components/section-icons';
import { StandaloneAgentsLane } from '../../../../../features/session/components/StandaloneAgentsLane';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { SectionToggle } from './SectionToggle';
import { PlanReadySuggestion } from './PlanReadySuggestion';
import { WorkflowStartButton } from './WorkflowStartButton';
import { CollapsedSummary } from './CollapsedSummary';
import { WorkflowRow } from './WorkflowRow';
import { useAgentsSection } from './useAgentsSection';
import { pluralize } from '../lib';

const FIRST_HEADER_CLASS = 'pb-1.5';
const SUBSEQUENT_HEADER_CLASS = 'mt-6 pb-1.5';

type Props = {
  task: Session;
  only?: 'workflows';
  workflowRunId?: WorkflowRunId;
  workflowVariant?: 'sidebar' | 'detail';
  showWorkflowAttach?: boolean;
};

export const AgentsSection = ({
  task,
  only,
  workflowRunId,
  workflowVariant = 'sidebar',
  showWorkflowAttach = true,
}: Props) => {
  const forceExpanded = only === 'workflows';
  const showSidebarSections = only == null;
  const section = useAgentsSection({ task, workflowRunId });
  const isWorkflowExpanded = forceExpanded || section.workflowExpanded;
  const areAgentsExpanded = forceExpanded || section.agentsExpanded;

  return (
    <section className="flex flex-col">
      {!forceExpanded && (
        <SectionHeader
          className={FIRST_HEADER_CLASS}
          icon={<SECTION_ICONS.workflows size={11} aria-hidden className="text-primary" />}
          label="Workflow"
          action={
            <SectionToggle
              expanded={section.workflowExpanded}
              label="workflow"
              onToggle={() =>
                section.setPanelSectionExpanded(task.id, 'workflow', !section.workflowExpanded)
              }
            />
          }
        />
      )}
      {!isWorkflowExpanded && (
        <CollapsedSummary
          text={
            section.hasAnyWorkflow
              ? pluralize(section.attachedRuns.length, 'workflow')
              : 'No workflows yet'
          }
        />
      )}
      {isWorkflowExpanded && !section.hasAnyWorkflow && <WorkflowStartButton sessionId={task.id} />}
      {isWorkflowExpanded && section.hasAnyWorkflow && (
        <div className="flex flex-col gap-1.5">
          <div className={cn('flex flex-col', forceExpanded ? 'gap-3' : 'gap-0.5')}>
            {section.visibleWorkflowRuns.map(({ run, workflow }) => (
              <WorkflowRow
                key={run.id}
                run={run}
                workflow={workflow}
                index={section.attachedRuns.findIndex(
                  ({ run: candidate }) => candidate.id === run.id,
                )}
                task={task}
                attachedRuns={section.attachedRuns}
                agentsByRunId={section.agentsByRunId}
                actionableStepIdByRunId={section.actionableStepIdByRunId}
                blockReasonByRunId={section.blockReasonByRunId}
                countUnread={section.countUnread}
                focusedWorkflowRunId={section.focusedWorkflowRunId}
                workflowExpand={section.workflowExpand}
                workflowNameByRunId={section.workflowNameByRunId}
                forceExpanded={forceExpanded}
                variant={workflowVariant}
                toggleWorkflowExpand={section.toggleWorkflowExpand}
                startWorkflowRun={section.startWorkflowRun}
                setWorkflowRunAutoRun={section.setWorkflowRunAutoRun}
                onReorderWorkflow={section.onReorderWorkflow}
                onDiscardWorkflow={section.onDiscardWorkflow}
                onDeleteWorkflow={section.onDeleteWorkflow}
                agentKindOverride={section.agentKindOverride}
                agentModelOverride={section.agentModelOverride}
                childrenByParentId={section.childrenByParentId}
                clusterExpand={section.clusterExpand}
                selectedAgentId={section.selectedAgentId}
                isTaskActive={section.isTaskActive}
                editingId={section.editingId}
                latestTelemetryByAgentId={section.metrics.latestTelemetryByAgentId}
                aggregatesByAgentId={section.metrics.aggregatesByAgentId}
                providerUsageByAgentId={section.metrics.providerUsageByAgentId}
                turnsByAgentId={section.metrics.turnsByAgentId}
                isTranscriptLoading={section.isTranscriptLoading}
                onStartStepAgent={section.onStartStepAgent}
                onPickAgent={section.onPickAgent}
                setEditingId={section.setEditingId}
                onRenameCommit={section.onRenameCommit}
                onResolveFirstForRun={section.onResolveFirstForRun}
                toggleClusterExpand={section.toggleClusterExpand}
                skipStuckStepAndAdvance={section.skipStuckStepAndAdvance}
              />
            ))}
          </div>
          {showWorkflowAttach && <WorkflowAttachButton sessionId={task.id} placement="inline" />}
        </div>
      )}

      {showSidebarSections && (
        <>
          <SectionHeader
            className={SUBSEQUENT_HEADER_CLASS}
            icon={<DogMascot size={14} className="shrink-0 text-success" />}
            label="Agents"
            action={
              <SectionToggle
                expanded={section.agentsExpanded}
                label="agents"
                onToggle={() =>
                  section.setPanelSectionExpanded(task.id, 'agents', !section.agentsExpanded)
                }
              />
            }
          />
          {areAgentsExpanded ? (
            <div className="pl-2">
              <StandaloneAgentsLane session={task} variant="sidebar" />
            </div>
          ) : (
            <CollapsedSummary
              text={
                section.standaloneAgentCount === 0
                  ? 'No agents yet'
                  : pluralize(section.standaloneAgentCount, 'agent')
              }
            />
          )}
          {section.spawnError != null && (
            <p className="px-2 text-2xs text-danger">{section.spawnError}</p>
          )}
          <PlanReadySuggestion task={task} />
          <ScriptsSection
            sessionId={task.id}
            workspaceId={task.workspaceId}
            worktreePath={section.worktreePath}
          />
        </>
      )}
    </section>
  );
};
