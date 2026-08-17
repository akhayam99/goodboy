import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button, Chip, StatusDot, Tooltip } from '@goodboy/ui';
import type { DiffComment, SessionId } from '@goodboy/types';
import { classifyWorkflowChain, upcomingSteps } from '@goodboy/core';
import { useAppStore } from '../../../../../../store';
import { workflowKindName } from '../../../../../workspace/components/WorkspacesSidebar/lib';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { TimelineAgentRow } from './TimelineAgentRow';
import { TimelineArtifactRow } from './TimelineArtifactRow';
import { TimelineGhostRow } from './TimelineGhostRow';
import type { WorkflowAdvanceState } from '../../../../../workflows/advanceGate';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly sessionId: SessionId;
  readonly aggregatesByAgentId: ReadonlyMap<
    string,
    { readonly turns: number; readonly estimatedCostUsd: number }
  >;
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

export const TimelineRunRow = ({
  entry,
  sessionId,
  aggregatesByAgentId,
  timeLabel,
  advanceState,
  onAdvance,
  diffCommentByAgentId,
}: Props) => {
  const agentChildren = entry.children.filter((child) => child.kind === 'agent');
  const runAgents = [...agentChildren.map((child) => child.agent), ...entry.pendingAgents];
  const isRunning = runAgents.some((agent) => agent.status === 'running');
  const isFailed = runAgents.some((agent) => agent.status === 'failed');
  const isComplete =
    runAgents.length > 0 &&
    runAgents.every((agent) => agent.status === 'completed' || agent.status === 'skipped');
  const [isOpen, setIsOpen] = useState(!isComplete && entry.run.discardedAt == null);
  const chain = classifyWorkflowChain(entry.workflow, runAgents);
  const ghostStep = chain.kind === 'step' ? chain.step : null;
  const ghostAgent =
    ghostStep == null ? null : (runAgents.find((agent) => agent.stepId === ghostStep.id) ?? null);
  const remaining = Math.max(0, upcomingSteps(entry.workflow, runAgents).length - 1);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const title = runTitle({ entry });
  const done = runAgents.filter(
    (agent) => agent.status === 'completed' || agent.status === 'skipped',
  ).length;
  const cost = runAgents.reduce((total, agent) => {
    const aggregate = aggregatesByAgentId.get(agent.id);
    return aggregate != null && aggregate.turns > 0 ? total + aggregate.estimatedCostUsd : total;
  }, 0);
  const meta = `${done}/${runAgents.length}${cost > 0 ? ` · $${cost.toFixed(2)}` : ''}`;
  const titleNode = (
    <span className="truncate text-sm font-medium text-foreground">{title.label}</span>
  );

  return (
    <div className="flex flex-col">
      <div className="grid min-h-9 grid-cols-[44px_24px_minmax(0,1fr)]">
        <span className="self-center text-right text-3xs tabular-nums text-muted-foreground">
          {timeLabel}
        </span>
        <div className="relative flex items-center justify-center">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <span className="relative z-10 flex size-4 items-center justify-center rounded-full bg-elevated ring-1 ring-border">
            {isRunning ? (
              <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" />
            ) : isFailed ? (
              <X size={10} aria-label="Failed" className="text-danger" />
            ) : isComplete ? (
              <Check size={10} aria-label="Completed" className="text-success" />
            ) : null}
          </span>
        </div>
        <div className="group flex min-w-0 items-center gap-2 py-1.5">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title.label}`}
            onClick={() => setIsOpen((current) => !current)}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            {title.tooltip != null ? (
              <Tooltip content={title.tooltip}>{titleNode}</Tooltip>
            ) : (
              titleNode
            )}
            <Chip
              tone="accent"
              label={workflowKindName(entry.workflow).toLowerCase()}
              shape="badge"
              size="xs"
              width="sm"
            />
          </button>
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{meta}</span>
          <span className="flex flex-1 items-center justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFocusedWorkflowRun(sessionId, entry.run.id);
                setActiveLens(sessionId, 'workflows');
              }}
            >
              View run
            </Button>
            {isOpen ? (
              <ChevronDown size={13} aria-hidden />
            ) : (
              <ChevronRight size={13} aria-hidden />
            )}
          </span>
        </div>
      </div>
      {isOpen
        ? entry.children.map((child) =>
            child.kind === 'agent' ? (
              <TimelineAgentRow
                key={child.id}
                entry={child}
                sessionId={sessionId}
                estimatedCostUsd={aggregatesByAgentId.get(child.agent.id)?.estimatedCostUsd ?? null}
                timeLabel={null}
                diffComment={diffCommentByAgentId.get(child.agent.id) ?? null}
              />
            ) : (
              <TimelineArtifactRow
                key={child.id}
                entry={child}
                sessionId={sessionId}
                timeLabel={null}
              />
            ),
          )
        : null}
      {isOpen && ghostStep != null && ghostAgent?.status === 'pending' ? (
        <TimelineGhostRow
          title={ghostStep.name}
          remaining={remaining}
          canAdvance={advanceState.kind === 'ready'}
          onAdvance={() => onAdvance({ agentId: ghostAgent.id })}
        />
      ) : null}
    </div>
  );
};
