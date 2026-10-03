import { SectionHeader, cn, tintClasses } from '@goodboy/ui';
import type { Session, WorkflowRunId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { StandaloneAgentsLane } from '../StandaloneAgentsLane';
import { WorkflowAttachButton } from '../../../workflows/components/WorkflowAttachButton';
import { SectionToggle } from './SectionToggle';
import { WorkflowStartButton } from './WorkflowStartButton';
import { CollapsedSummary } from './CollapsedSummary';
import { WorkflowRow } from './WorkflowRow';
import { useAgentsSection } from './useAgentsSection';
import { pluralize } from '../../../../shared/utils/pluralize';

const FIRST_HEADER_CLASS = 'pb-1.5';
const SUBSEQUENT_HEADER_CLASS = 'mt-6 pb-1.5';

type Props = {
  task: Session;
  only?: 'workflows';
  workflowRunId?: WorkflowRunId;
  showWorkflowAttach?: boolean;
};

export const AgentsSection = ({ task, only, workflowRunId, showWorkflowAttach = true }: Props) => {
  const forceExpanded = only === 'workflows';
  const showSidebarSections = only == null;
  const section = useAgentsSection({ task, workflowRunId });
  const isWorkflowExpanded = forceExpanded || section.workflowExpanded;
  const areAgentsExpanded = forceExpanded || section.agentsExpanded;

  return (
    <section className={cn('flex flex-col', forceExpanded && 'min-h-0 flex-1')}>
      {!forceExpanded && (
        <SectionHeader
          className={FIRST_HEADER_CLASS}
          icon={<CONCEPT_ICONS.workflows size={11} aria-hidden className="text-primary" />}
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
        <div className={cn('flex flex-col gap-1.5', forceExpanded && 'min-h-0 flex-1')}>
          <div className={cn('flex flex-col', forceExpanded ? 'min-h-0 flex-1 gap-3' : 'gap-0.5')}>
            {section.visibleWorkflowRuns.map(({ run, workflow }) => (
              <WorkflowRow
                key={run.id}
                run={run}
                workflow={workflow}
                task={task}
                agentsByRunId={section.agentsByRunId}
                actionableStepIdByRunId={section.actionableStepIdByRunId}
                blockReasonByRunId={section.blockReasonByRunId}
                focusedWorkflowRunId={section.focusedWorkflowRunId}
                viewedWorkflowRunId={workflowRunId ?? null}
                workflowExpand={section.workflowExpand}
                workflowNameByRunId={section.workflowNameByRunId}
                toggleWorkflowExpand={section.toggleWorkflowExpand}
                startWorkflowRun={section.startWorkflowRun}
                setWorkflowRunAutoRun={section.setWorkflowRunAutoRun}
                agentKindOverride={section.agentKindOverride}
                agentModelOverride={section.agentModelOverride}
                agentProviderOverride={section.agentProviderOverride}
                agentEffortOverride={section.agentEffortOverride}
                childrenByParentId={section.childrenByParentId}
                selectedAgentId={section.selectedAgentId}
                aggregatesByAgentId={section.metrics.aggregatesByAgentId}
                onStartStepAgent={section.onStartStepAgent}
                onPickAgent={section.onPickAgent}
                onAnswerQuestion={section.onAnswerQuestion}
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
            icon={
              <CONCEPT_ICONS.agents
                size={ICON_SIZE.control}
                aria-hidden
                className={cn('shrink-0', tintClasses(CONCEPT_TONE.agents).icon)}
              />
            }
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
            <p className="px-2 text-secondary text-danger">{section.spawnError}</p>
          )}
        </>
      )}
    </section>
  );
};
