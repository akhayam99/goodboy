import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Popover, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId, Workflow } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useDropdown } from '../../../../../shared/hooks/useDropdown';
import { RoutingBadge } from '../../../../../shared/components/RoutingBadge';
import { resolveRootAgent } from '../../../agent-kind';
import { WorkflowStripStatus } from './WorkflowStripStatus';

const CRUMB_CLASS =
  'flex min-w-0 items-center gap-1 rounded-sm text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session;
  readonly selectedAgentId: AgentId;
  readonly homeLabel: string;
  readonly onHome: () => void;
};

export const WorkflowBreadcrumb = ({
  sessionId,
  session,
  selectedAgentId,
  homeLabel,
  onHome,
}: Props) => {
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
  const stepMenu = useDropdown({ align: 'start', expectedHeight: 260, width: 'w-60' });
  const agentMenu = useDropdown({ align: 'start', expectedHeight: 260, width: 'w-72' });

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

  const run = session.workflowRuns.find((candidate) => candidate.id === rootAgent?.workflowRunId);
  const workflow = run == null ? null : (workflowById.get(run.workflowId) ?? null);
  const stepRoots = useMemo(() => {
    const roots = new Map<string, Agent>();
    if (run == null) {
      return roots;
    }
    for (const agent of phaseRuns) {
      if (agent.workflowRunId === run.id && agent.stepId != null && agent.parentAgentId == null) {
        roots.set(agent.stepId, agent);
      }
    }
    return roots;
  }, [phaseRuns, run]);

  const selectedAgent = phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null;
  const clusterChildren = useMemo(
    () =>
      rootAgent == null
        ? (EMPTY_ARRAY as ReadonlyArray<Agent>)
        : phaseRuns.filter((agent) => agent.parentAgentId === rootAgent.id),
    [phaseRuns, rootAgent],
  );
  const currentStep = workflow?.steps.find((step) => step.id === rootAgent?.stepId) ?? null;
  const stepLabel = currentStep?.name ?? rootAgent?.name ?? null;
  const completedClusters = clusterChildren.filter((agent) => agent.status === 'completed').length;
  const isRootSelected = rootAgent != null && rootAgent.id === selectedAgentId;
  const agentCrumbLabel = isRootSelected
    ? `${completedClusters}/${clusterChildren.length} clusters`
    : (selectedAgent?.name ?? rootAgent?.name ?? '');

  return (
    <nav aria-label="workflow breadcrumb" className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={onHome}
        title={homeLabel}
        className={cn(CRUMB_CLASS, 'max-w-40 shrink-0 text-muted-foreground hover:text-foreground')}
      >
        <span className="truncate">{homeLabel}</span>
      </button>
      {stepLabel != null && (
        <>
          <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
          <div ref={stepMenu.containerRef} className="relative flex min-w-0 items-center">
            <button
              type="button"
              onClick={stepMenu.toggle}
              aria-haspopup="menu"
              aria-expanded={stepMenu.open}
              title={`${stepLabel}. Switch step.`}
              className={cn(
                CRUMB_CLASS,
                'font-semibold text-foreground/90 hover:text-foreground',
                clusterChildren.length > 0 && 'text-muted-foreground',
              )}
            >
              <span className="min-w-0 max-w-48 truncate">{stepLabel}</span>
              <ChevronDown
                size={11}
                aria-hidden
                className={cn('shrink-0 text-muted-foreground/60', stepMenu.open && 'rotate-180')}
              />
            </button>
            {stepMenu.open && workflow != null && (
              <Popover
                role="menu"
                ariaLabel="switch step"
                className={cn(stepMenu.popupClassName, 'flex flex-col bg-subtle')}
              >
                <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-64">
                  <div className="flex flex-col gap-0.5 p-1">
                    {workflow.steps.map((step, index) => {
                      const stepRoot = stepRoots.get(step.id) ?? null;
                      const isPending = stepRoot == null || stepRoot.status === 'pending';
                      return (
                        <button
                          key={step.id}
                          type="button"
                          role="menuitem"
                          disabled={isPending}
                          aria-current={stepRoot?.id === rootAgent?.id ? 'step' : undefined}
                          onClick={() => {
                            if (stepRoot == null || isPending) {
                              return;
                            }
                            stepMenu.close();
                            void selectAgent(sessionId, stepRoot.id);
                          }}
                          className={cn(
                            'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-default disabled:opacity-40',
                            stepRoot?.id === rootAgent?.id
                              ? 'bg-background text-foreground'
                              : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                          )}
                        >
                          <WorkflowStripStatus
                            status={stepRoot?.status ?? null}
                            label={step.name}
                            variant="pill"
                          />
                          <span className="shrink-0 tabular-nums text-muted-foreground/50">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{step.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollFade>
              </Popover>
            )}
          </div>
        </>
      )}
      {clusterChildren.length > 0 && rootAgent != null && (
        <>
          <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
          <div ref={agentMenu.containerRef} className="relative flex min-w-0 items-center">
            <button
              type="button"
              onClick={agentMenu.toggle}
              aria-haspopup="menu"
              aria-expanded={agentMenu.open}
              title={`${agentCrumbLabel}. Switch agent.`}
              className={cn(
                CRUMB_CLASS,
                'font-semibold text-foreground/90 hover:text-foreground',
                isRootSelected && 'font-normal tabular-nums text-muted-foreground',
              )}
            >
              <span className="min-w-0 max-w-48 truncate">{agentCrumbLabel}</span>
              <ChevronDown
                size={11}
                aria-hidden
                className={cn('shrink-0 text-muted-foreground/60', agentMenu.open && 'rotate-180')}
              />
            </button>
            {agentMenu.open && (
              <Popover
                role="menu"
                ariaLabel="switch agent"
                className={cn(agentMenu.popupClassName, 'flex flex-col bg-subtle')}
              >
                <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-64">
                  <div className="flex flex-col gap-0.5 p-1">
                    {[rootAgent, ...clusterChildren].map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        role="menuitem"
                        aria-current={agent.id === selectedAgentId ? 'true' : undefined}
                        onClick={() => {
                          agentMenu.close();
                          void selectAgent(sessionId, agent.id);
                        }}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          agent.id === selectedAgentId
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                        )}
                      >
                        <WorkflowStripStatus
                          status={agent.status}
                          label={agent.name}
                          variant="child"
                        />
                        <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                        <RoutingBadge
                          className="shrink-0"
                          provider={agent.providerOverride ?? null}
                          model={agent.modelOverride ?? null}
                          effort={agent.effort ?? null}
                          missingLabel="inherited"
                        />
                      </button>
                    ))}
                  </div>
                </ScrollFade>
              </Popover>
            )}
          </div>
        </>
      )}
    </nav>
  );
};
