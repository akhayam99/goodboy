import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Chip, Tooltip } from '@goodboy/ui';
import type { DiffComment, SessionId } from '@goodboy/types';
import { classifyWorkflowChain } from '@goodboy/core';
import { useAppStore } from '../../../../../../store';
import { workflowKindName } from '../../../../../workspace/components/WorkspacesSidebar/lib';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { TimelineAgentRow } from './TimelineAgentRow';
import { TimelineAnswerRow } from './TimelineAnswerRow';
import { TimelineArtifactRow } from './TimelineArtifactRow';
import { TimelineGhostRow } from './TimelineGhostRow';
import { TimelineNode, type TimelineNodeStatus } from './TimelineNode';
import { TimelineRow } from './TimelineRow';
import type { WorkflowAdvanceState } from '../../../../../workflows/advanceGate';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
  readonly advanceState: WorkflowAdvanceState;
  readonly onAdvance: (params: AdvanceParams) => void;
  readonly diffCommentByAgentId: ReadonlyMap<string, DiffComment>;
};

type AdvanceParams = {
  readonly agentId: string;
};

type RunTitleParams = {
  readonly entry: TimelineRunEntry;
};

type RunTitle = {
  readonly label: string;
  readonly tooltip: string | null;
};

const PLACEHOLDER_NAME = /^orchestrated workflow( \d+)?$/i;

const runTitle = ({ entry }: RunTitleParams): RunTitle => {
  if (!PLACEHOLDER_NAME.test(entry.workflow.name)) {
    return { label: entry.workflow.name, tooltip: null };
  }
  if (entry.producedPlan != null) {
    return { label: entry.producedPlan.title, tooltip: 'Auto-titled from its plan' };
  }
  return { label: 'Unnamed workflow', tooltip: 'Not yet named' };
};

type RunStatusParams = {
  readonly entry: TimelineRunEntry;
};

const runStatusOf = ({ entry }: RunStatusParams): TimelineNodeStatus => {
  const agents = [
    ...entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent] : [])),
    ...entry.pendingAgents,
  ];
  if (agents.some((agent) => agent.status === 'running')) {
    return 'running';
  }
  if (agents.some((agent) => agent.status === 'failed')) {
    return 'failed';
  }
  if (agents.length === 0) {
    return 'waiting';
  }
  if (agents.every((agent) => agent.status === 'completed' || agent.status === 'skipped')) {
    return 'completed';
  }
  return 'waiting';
};

export const TimelineRunRow = ({
  entry,
  sessionId,
  timeLabel,
  advanceState,
  onAdvance,
  diffCommentByAgentId,
}: Props) => {
  const runAgents = [
    ...entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent] : [])),
    ...entry.pendingAgents,
  ];
  const isComplete =
    runAgents.length > 0 &&
    runAgents.every((agent) => agent.status === 'completed' || agent.status === 'skipped');
  const [isOpen, setIsOpen] = useState(!isComplete && entry.run.discardedAt == null);
  const chain = classifyWorkflowChain(entry.workflow, runAgents);
  const ghostStep = chain.kind === 'step' ? chain.step : null;
  const ghostAgent =
    ghostStep == null ? null : (runAgents.find((agent) => agent.stepId === ghostStep.id) ?? null);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const title = runTitle({ entry });
  const status = runStatusOf({ entry });
  const navigate = () => {
    setFocusedWorkflowRun(sessionId, entry.run.id);
    setActiveLens(sessionId, 'workflows');
  };
  const label = (
    <>
      {title.tooltip != null ? (
        <Tooltip content={title.tooltip}>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {title.label}
          </span>
        </Tooltip>
      ) : (
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{title.label}</span>
      )}
      <Chip
        tone="accent"
        label={workflowKindName(entry.workflow).toLowerCase()}
        shape="badge"
        size="xs"
        width="sm"
      />
    </>
  );
  const trailing = (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title.label}`}
      onClick={(event) => {
        event.stopPropagation();
        setIsOpen((current) => !current);
      }}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {isOpen ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
    </button>
  );

  return (
    <div className="flex flex-col">
      <TimelineRow
        timeLabel={timeLabel}
        depth={0}
        hasRoleColumn
        marker={<TimelineNode status={status} />}
        roleChip={null}
        onClick={navigate}
        ariaLabel={`open ${title.label} workflow`}
        label={label}
        trailing={trailing}
      />
      {isOpen
        ? entry.children.map((child) => {
            if (child.kind === 'agent') {
              return (
                <TimelineAgentRow
                  key={child.id}
                  entry={child}
                  sessionId={sessionId}
                  timeLabel={null}
                  diffComment={diffCommentByAgentId.get(child.agent.id) ?? null}
                  hasRoleColumn
                />
              );
            }
            if (child.kind === 'plan') {
              return (
                <TimelineArtifactRow
                  key={child.id}
                  entry={child}
                  sessionId={sessionId}
                  timeLabel={null}
                  hasRoleColumn
                />
              );
            }
            return (
              <TimelineAnswerRow key={child.id} entry={child} timeLabel={null} hasRoleColumn />
            );
          })
        : null}
      {isOpen && ghostStep != null && ghostAgent?.status === 'pending' ? (
        <TimelineGhostRow
          title={ghostStep.name}
          canAdvance={advanceState.kind === 'ready'}
          onAdvance={() => onAdvance({ agentId: ghostAgent.id })}
        />
      ) : null}
    </div>
  );
};
