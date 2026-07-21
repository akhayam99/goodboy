import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Workflow as WorkflowIcon } from 'lucide-react';
import type { Agent, AgentId, Session, SessionId, Workflow } from '@goodboy/types';
import { Popover, cn } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { resolveRootAgent } from '../../../agent-kind';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowStripStatus } from './WorkflowStripStatus';

const POPOVER_WIDTH = 224;
const POPOVER_EDGE_INSET = 8;

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session;
  readonly selectedAgentId: AgentId;
};

export const WorkflowStrip = ({ sessionId, session, selectedAgentId }: Props) => {
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const phaseTemplates = useAppStore(
    (state) =>
      state.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionWorkflows = useAppStore(
    (state) => state.sessionWorkflows[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const selectAgent = useAppStore((state) => state.selectAgent);
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const [openClusterRootId, setOpenClusterRootId] = useState<AgentId | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<Readonly<{
    top: number;
    left: number;
  }> | null>(null);

  const rootAgent = useMemo(
    () => resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId }),
    [phaseRuns, selectedAgentId],
  );
  const workflowById = useMemo(() => {
    const workflows = new Map<string, Workflow>();
    for (const workflow of phaseTemplates) {
      workflows.set(workflow.id, workflow);
    }
    for (const workflow of sessionWorkflows) {
      workflows.set(workflow.id, workflow);
    }
    return workflows;
  }, [phaseTemplates, sessionWorkflows]);

  if (rootAgent?.workflowRunId == null) {
    return null;
  }
  const run = session.workflowRuns.find((candidate) => candidate.id === rootAgent.workflowRunId);
  if (run == null) {
    return null;
  }
  const workflow = workflowById.get(run.workflowId) ?? null;
  if (workflow == null) {
    return null;
  }

  const stepRoots = new Map(
    phaseRuns
      .filter(
        (agent) =>
          agent.workflowRunId === run.id && agent.stepId != null && agent.parentAgentId == null,
      )
      .map((agent) => [agent.stepId, agent]),
  );
  const openClusterRoot =
    openClusterRootId == null
      ? null
      : (phaseRuns.find((agent) => agent.id === openClusterRootId) ?? null);
  const openClusterChildren =
    openClusterRoot == null
      ? EMPTY_ARRAY
      : phaseRuns.filter((agent) => agent.parentAgentId === openClusterRoot.id);

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap"
      aria-label="workflow steps"
    >
      <button
        type="button"
        onClick={() => {
          setFocusedWorkflowRun(sessionId, run.id);
          setActiveLens(sessionId, 'workflows');
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-soft bg-subtle px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <WorkflowIcon size={12} aria-hidden className="shrink-0 text-accent" />
        <span className="max-w-40 truncate">{workflowKindName(workflow)}</span>
      </button>
      {workflow.steps.map((step, index) => {
        const stepRoot = stepRoots.get(step.id) ?? null;
        const isPending = stepRoot == null || stepRoot.status === 'pending';
        const isCurrent = stepRoot?.id === rootAgent.id;
        const clusterChildren =
          stepRoot == null
            ? EMPTY_ARRAY
            : phaseRuns.filter((agent) => agent.parentAgentId === stepRoot.id);
        const completedChildren = clusterChildren.filter(
          (agent) => agent.status === 'completed' || agent.status === 'skipped',
        ).length;

        return (
          <div
            key={step.id}
            className={cn(
              'flex shrink-0 items-center rounded-lg border text-xs transition-colors',
              isCurrent
                ? 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20'
                : isPending
                  ? 'border-border-soft/60 bg-subtle/50 text-muted-foreground/60'
                  : 'border-border-soft bg-subtle text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <button
              type="button"
              disabled={isPending}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${index + 1} ${step.name}`}
              onClick={() => {
                if (stepRoot == null || isPending) {
                  return;
                }
                void selectAgent(sessionId, stepRoot.id);
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default"
            >
              <span className="text-2xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <WorkflowStripStatus
                status={stepRoot?.status ?? null}
                label={step.name}
                variant="pill"
              />
              <span>{step.name}</span>
            </button>
            {stepRoot != null && clusterChildren.length > 0 ? (
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openClusterRootId === stepRoot.id}
                aria-label={`clusters ${completedChildren}/${clusterChildren.length} for ${step.name}`}
                onClick={(event) => {
                  if (openClusterRootId === stepRoot.id) {
                    setOpenClusterRootId(null);
                    setPopoverPosition(null);
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpenClusterRootId(stepRoot.id);
                  setPopoverPosition({
                    top: rect.bottom + 6,
                    left: Math.max(
                      POPOVER_EDGE_INSET,
                      Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH),
                    ),
                  });
                }}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-2xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {completedChildren}/{clusterChildren.length}
                <ChevronDown size={10} aria-hidden />
              </button>
            ) : null}
          </div>
        );
      })}
      {openClusterRoot != null && popoverPosition != null
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => {
                  setOpenClusterRootId(null);
                  setPopoverPosition(null);
                }}
                aria-hidden
              />
              <Popover
                role="menu"
                ariaLabel={`clusters for ${openClusterRoot.name}`}
                className="fixed z-40 flex w-56 flex-col gap-0.5 p-1"
                style={popoverPosition}
              >
                {openClusterChildren.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    role="menuitem"
                    aria-current={child.id === selectedAgentId ? 'true' : undefined}
                    onClick={() => {
                      setOpenClusterRootId(null);
                      setPopoverPosition(null);
                      void selectAgent(sessionId, child.id);
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      child.id === selectedAgentId
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    <WorkflowStripStatus status={child.status} label={child.name} variant="child" />
                    <span className="min-w-0 flex-1 truncate">{child.name}</span>
                  </button>
                ))}
              </Popover>
            </>,
            document.body,
          )
        : null}
    </div>
  );
};
