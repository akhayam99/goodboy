import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { Divider, ResizeHandle, cn } from '@goodboy/ui';
import { TerminalDock } from '../../../terminal/components/TerminalDock';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ScriptsPanel } from '../../../scripts';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  readPersistedLens,
  useAppStore,
  useFilesTouched,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { worktreeStatus } from '../../../worktree/worktree';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { AppBreadcrumb } from '../../../../app/components/AppBreadcrumb';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { AgentOverlay } from './parts/AgentOverlay';
import { AgentsPane } from './parts/AgentsPane';
import { Pane } from './parts/Pane';
import { SessionStudioLayer } from './parts/SessionStudioLayer';
import { SessionTopBar } from './parts/SessionTopBar';
import { LensColumn } from './parts/LensColumn';
import { QuestionsPane } from './parts/QuestionsPane';
import { SlotPane } from './parts/SlotPane';
import { ResolvePane } from './parts/ResolvePane';
import { PrPane } from './parts/PrPane';
import { FilesPane } from './parts/FilesPane';
import { PaneShell } from './parts/PaneShell';
import { useSelectedAgentHome } from './hooks/useSelectedAgentHome';
import { buildSessionBreadcrumb } from './sessionBreadcrumb';
import { resolveOverlayHome } from './resolveOverlayHome';
import { WorkflowsPane } from './parts/WorkflowsPane';
import { IntegrationPane } from './parts/IntegrationPane';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { isStandaloneAgent, resolveRootAgent } from '../../agent-kind';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { SessionOverviewSkeleton } from './parts/SessionOverviewSkeleton';
import { ReviewBoardPane } from '../../../review/components/ReviewBoardPane';
import { useColumnWidth } from '../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';

const LENS_LABEL: Record<LensKind, string> = {
  questions: 'Questions',
  agents: 'Agents',
  workflows: 'Workflows',
  resolve: 'Resolve',
  review: 'Review board',
  plans: 'Plans',
  scripts: 'Scripts',
  terminal: 'Terminal',
  goal: 'Goal',
  decisions: 'Decisions',
  last_output_summary: 'Session summary',
  pr: 'Pull request',
  files: 'Diff',
  linear: 'Linear',
  sentry: 'Sentry',
  gitlab_issues: 'GitLab issues',
};

const SIMPLE_LENSES = new Set<LensKind>([
  'workflows',
  'agents',
  'questions',
  'plans',
  'goal',
  'decisions',
  'last_output_summary',
]);

type SessionWorkspaceProps = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionWorkspace = ({ session, isActive }: SessionWorkspaceProps) => {
  const sessionId = session.id as SessionId;
  const [lensColumnWidth, setLensColumnWidth] = useColumnWidth(STORAGE_KEYS.lensColumnWidth, 240);
  const [inspectedResolverId, setInspectedResolverId] = useState<AgentId | null>(null);
  const [inspectedAgentId, setInspectedAgentId] = useState<AgentId | null>(null);
  const [showCompletedAgents, setShowCompletedAgents] = useState(false);
  const [showCompletedResolvers, setShowCompletedResolvers] = useState(false);
  const hasInitializedResolverInspector = useRef(false);
  const hasInitializedAgentInspector = useRef(false);
  const storedActiveLens = useAppStore((s) => s.activeLens[sessionId]);
  const workspaceKind = useAppStore(
    (s) => s.workspaces?.find((workspace) => workspace.id === session.workspaceId)?.kind ?? 'repo',
  );
  const sessionBranch = useAppStore((s) => s.sessionBranches[sessionId]);
  const isBranchless = isBranchlessSession({ workspaceKind, branch: sessionBranch });
  const activeLens =
    isBranchless && storedActiveLens != null && !SIMPLE_LENSES.has(storedActiveLens)
      ? null
      : storedActiveLens;
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const agentHome = useSelectedAgentHome(sessionId);
  const workingDir = useAppStore((s) => (s.sessionWorktrees[sessionId] ?? [])[0] ?? null);
  const sessionRepo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const projectWorktreePath = sessionRepo?.worktreePath ?? null;
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const setSessionStudio = useAppStore((s) => s.setSessionStudio);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  const filesTouched = useFilesTouched(sessionId, isActive && !isBranchless);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const attachedWorkflowRuns = useAttachedWorkflowRuns({ session });
  const plans = useSessionPlans(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const sessionLoading = useAppStore((s) => s.sessionLoading[sessionId]);

  useEffect(() => {
    if (activeLens === undefined) {
      setActiveLens(sessionId, readPersistedLens(sessionId));
    }
  }, [activeLens, sessionId, setActiveLens]);

  useEffect(() => {
    if (!isActive || projectWorktreePath == null || isBranchless) return;
    let cancelled = false;
    worktreeStatus(projectWorktreePath)
      .then((status) => {
        if (!cancelled && status.branch) {
          void reconcileSessionBranch(sessionId, status.branch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    filesTouched.count,
    isActive,
    isBranchless,
    projectWorktreePath,
    reconcileSessionBranch,
    sessionId,
  ]);

  const lens: LensKind | null = activeLens ?? null;
  const isOverviewLoading = sessionLoading?.agents === true || sessionLoading?.plans === true;
  const isFreshOverviewLayout = session.workflowRuns.every((run) => run.discardedAt != null);
  const onSelectLens = (next: LensKind) => {
    setActiveLens(sessionId, next);
  };
  const onSelectOverview = () => {
    setActiveLens(sessionId, null);
  };
  const showStudio = studio != null;
  const showAgentOverlay = selectedAgentId != null && !showStudio;
  const showLens = selectedAgentId == null && !showStudio;
  const overlayHome = resolveOverlayHome({ lens, agentHome });
  const selectedRootAgent = useMemo(() => {
    if (selectedAgentId == null) {
      return null;
    }
    return resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId });
  }, [phaseRuns, selectedAgentId]);
  const selectedWorkflowRunId = selectedRootAgent?.workflowRunId ?? null;
  const showWorkflowStrip =
    showAgentOverlay && overlayHome === 'workflows' && selectedWorkflowRunId != null;
  const resolverIndex = useResolverIndex(sessionId);
  const resolverAgentIds = useMemo(
    () => new Set(resolverIndex.links.map(({ agent }) => agent.id)),
    [resolverIndex],
  );
  const standaloneAgents = useMemo(
    () => phaseRuns.filter((agent) => isStandaloneAgent(agent) && !resolverAgentIds.has(agent.id)),
    [phaseRuns, resolverAgentIds],
  );
  const agentCounts = useMemo(
    () => ({
      running: standaloneAgents.filter((agent) => agent.status === 'running').length,
      done: standaloneAgents.filter(
        (agent) => agent.status === 'completed' || agent.status === 'skipped',
      ).length,
      failed: standaloneAgents.filter((agent) => agent.status === 'failed').length,
    }),
    [standaloneAgents],
  );
  const resolverCounts = useMemo(
    () => ({
      queued: resolverIndex.links.filter(({ status }) => status === 'pending').length,
      resolved: resolverIndex.links.filter(({ status }) => status === 'resolved').length,
    }),
    [resolverIndex],
  );
  const agentsMeta =
    agentCounts.running === 0 && agentCounts.done === 0 && agentCounts.failed === 0
      ? undefined
      : `${agentCounts.running} running, ${agentCounts.done} done${
          agentCounts.failed > 0 ? `, ${agentCounts.failed} failed` : ''
        }`;
  const resolveMeta =
    resolverCounts.queued === 0 && resolverCounts.resolved === 0
      ? undefined
      : `${resolverCounts.queued} queued, ${resolverCounts.resolved} resolved`;
  useEffect(() => {
    if (standaloneAgents.length === 0) {
      if (inspectedAgentId !== null) {
        setInspectedAgentId(null);
      }
      return;
    }
    if (lens !== 'agents') {
      return;
    }
    const isInspectedAgentPresent =
      inspectedAgentId !== null && standaloneAgents.some((agent) => agent.id === inspectedAgentId);
    if (isInspectedAgentPresent) {
      hasInitializedAgentInspector.current = true;
      return;
    }
    if (inspectedAgentId === null && hasInitializedAgentInspector.current) {
      return;
    }
    const newestAgents = [...standaloneAgents].sort((a, b) => b.ordinal - a.ordinal);
    const running = newestAgents.find((agent) => agent.status === 'running');
    const attention = newestAgents.find(
      (agent) =>
        agent.status === 'failed' ||
        agentHasUnread(agent, false) ||
        openQuestions.some((question) => question.createdByAgentId === agent.id),
    );
    hasInitializedAgentInspector.current = true;
    setInspectedAgentId((running ?? attention ?? newestAgents[0])?.id ?? null);
  }, [inspectedAgentId, lens, openQuestions, standaloneAgents]);

  useEffect(() => {
    if (resolverIndex.links.length === 0) {
      if (inspectedResolverId !== null) {
        setInspectedResolverId(null);
      }
      return;
    }
    const isInspectedResolverPresent =
      inspectedResolverId !== null &&
      resolverIndex.links.some(({ agent }) => agent.id === inspectedResolverId);
    if (isInspectedResolverPresent) {
      hasInitializedResolverInspector.current = true;
      return;
    }
    if (inspectedResolverId === null && hasInitializedResolverInspector.current) {
      return;
    }
    const running = resolverIndex.links.find(({ status }) => status === 'running');
    const awaiting = resolverIndex.links.find(({ status }) => status === 'awaiting');
    const unresolved = resolverIndex.links.find(
      ({ status }) => !['resolved', 'wontfix', 'stopped', 'done'].includes(status),
    );
    hasInitializedResolverInspector.current = true;
    setInspectedResolverId((running ?? awaiting ?? unresolved)?.agent.id ?? null);
  }, [inspectedResolverId, resolverIndex]);

  useEffect(() => {
    if (showAgentOverlay && overlayHome === 'resolve' && selectedAgentId !== null) {
      hasInitializedResolverInspector.current = true;
      setInspectedResolverId(selectedAgentId);
    }
  }, [overlayHome, selectedAgentId, showAgentOverlay]);

  useEffect(() => {
    const onOpenResolverInspector = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as { sessionId?: unknown; agentId?: unknown };
      if (detail.sessionId !== sessionId || typeof detail.agentId !== 'string') {
        return;
      }
      hasInitializedResolverInspector.current = true;
      setInspectedResolverId(detail.agentId as AgentId);
    };
    window.addEventListener('goodboy:open-resolver-inspector', onOpenResolverInspector);
    return () =>
      window.removeEventListener('goodboy:open-resolver-inspector', onOpenResolverInspector);
  }, [sessionId]);
  const focusedWorkflowName = useMemo(() => {
    const focusedRun = attachedWorkflowRuns.find(({ run }) => run.id === focusedWorkflowRunId);
    const visibleRun = focusedRun ?? (lens === 'workflows' ? attachedWorkflowRuns[0] : null);
    return visibleRun == null ? null : workflowKindName(visibleRun.workflow);
  }, [focusedWorkflowRunId, attachedWorkflowRuns, lens]);
  const focusedPlanTitle = useMemo(
    () => plans.find((p) => p.id === focusedPlanId)?.title ?? null,
    [plans, focusedPlanId],
  );

  const crumbs = useMemo(
    () =>
      buildSessionBreadcrumb({
        lens,
        studio,
        focusedWorkflowName,
        focusedPlanTitle,
        lensLabel: (l) => LENS_LABEL[l],
        handlers: {
          toOverview: () => setActiveLens(sessionId, null),
          toLens: (l) => setActiveLens(sessionId, l),
          toWorkflowsList: () => {
            setFocusedWorkflowRun(sessionId, null);
            setActiveLens(sessionId, 'workflows');
          },
          toPlansList: () => {
            setFocusedPlanId(sessionId, null);
            setActiveLens(sessionId, 'plans');
          },
        },
      }),
    [
      lens,
      studio,
      focusedWorkflowName,
      focusedPlanTitle,
      sessionId,
      setActiveLens,
      setFocusedWorkflowRun,
      setFocusedPlanId,
    ],
  );

  useEffect(() => {
    if (!showAgentOverlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setActiveLens(sessionId, overlayHome);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAgentOverlay, sessionId, overlayHome, setActiveLens]);

  return (
    <div className="flex h-full w-full flex-col">
      <SessionTopBar session={session} />
      {showAgentOverlay ? null : (
        <>
          <div className="flex min-w-0 shrink-0 items-center px-6 py-2.5">
            <AppBreadcrumb crumbs={crumbs} />
          </div>
          <Divider />
        </>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex shrink-0 flex-col bg-background" style={{ width: lensColumnWidth }}>
          <LensColumn
            session={session}
            activeLens={lens}
            onSelectOverview={onSelectOverview}
            onSelect={onSelectLens}
            filesCount={filesTouched.count}
            diffstat={{
              additions: filesTouched.additions,
              deletions: filesTouched.deletions,
            }}
            isBranchless={isBranchless}
          />
        </div>
        <ResizeHandle
          value={lensColumnWidth}
          min={200}
          max={400}
          onChange={setLensColumnWidth}
          onReset={() => setLensColumnWidth(240)}
          ariaLabel="resize lens column"
        />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {showLens ? (
              <div className="absolute inset-0 z-0">
                {lens === null ? (
                  isOverviewLoading ? (
                    <SessionOverviewSkeleton isFreshLayout={isFreshOverviewLayout} />
                  ) : (
                    <SessionOverviewPane session={session} onSelectLens={onSelectLens} />
                  )
                ) : null}
                {lens === 'questions' ? <QuestionsPane session={session} /> : null}
                {lens === 'plans' ? (
                  <PlanStudio sessionId={sessionId} initialPlanId={focusedPlanId ?? undefined} />
                ) : null}
                {lens === 'workflows' ? <WorkflowsPane session={session} /> : null}
                {lens === 'resolve' ? (
                  <ResolvePane
                    session={session}
                    meta={resolveMeta}
                    inspectedResolverId={inspectedResolverId}
                    onInspectResolver={setInspectedResolverId}
                    showCompleted={showCompletedResolvers}
                    onShowCompletedChange={setShowCompletedResolvers}
                  />
                ) : null}
                {lens === 'scripts' ? (
                  <PaneShell title="Scripts">
                    <ScriptsPanel
                      workspaceId={session.workspaceId}
                      sessionId={sessionId}
                      worktreePath={workingDir}
                      hasHostHeading
                    />
                  </PaneShell>
                ) : null}
                {lens === 'goal' || lens === 'decisions' || lens === 'last_output_summary' ? (
                  <SlotPane session={session} slotKey={lens} />
                ) : null}
                {lens === 'pr' ? <PrPane session={session} onSelectLens={onSelectLens} /> : null}
                {lens === 'review' ? <ReviewBoardPane session={session} /> : null}
                {lens === 'linear' ? (
                  <IntegrationPane
                    sessionId={sessionId}
                    workspaceId={session.workspaceId}
                    provider="linear"
                  />
                ) : null}
                {lens === 'sentry' ? (
                  <IntegrationPane
                    sessionId={sessionId}
                    workspaceId={session.workspaceId}
                    provider="sentry"
                  />
                ) : null}
                {lens === 'gitlab_issues' ? (
                  <IntegrationPane
                    sessionId={sessionId}
                    workspaceId={session.workspaceId}
                    provider="gitlab"
                  />
                ) : null}
                {lens === 'files' ? (
                  <FilesPane
                    sessionId={sessionId}
                    workingDir={projectWorktreePath}
                    worktreePath={projectWorktreePath}
                    onClose={onSelectOverview}
                  />
                ) : null}
                <Pane visible={lens === 'agents'}>
                  <AgentsPane
                    session={session}
                    meta={agentsMeta}
                    inspectedAgentId={inspectedAgentId}
                    onInspectAgent={setInspectedAgentId}
                    showCompleted={showCompletedAgents}
                    onShowCompletedChange={setShowCompletedAgents}
                  />
                </Pane>
              </div>
            ) : null}

            {showAgentOverlay ? (
              <AgentOverlay
                session={session}
                sessionId={sessionId}
                isChatActive={isActive && selectedAgentId != null}
                selectedAgentId={selectedAgentId}
                inspectedResolverId={
                  overlayHome === 'resolve' ? selectedAgentId : inspectedResolverId
                }
                overlayHome={overlayHome}
                overlayHomeLabel={LENS_LABEL[overlayHome]}
                showWorkflowStrip={showWorkflowStrip}
                onBack={() => setActiveLens(sessionId, overlayHome)}
                onOpenWorkflow={() => {
                  if (selectedWorkflowRunId == null) {
                    return;
                  }
                  setFocusedWorkflowRun(sessionId, selectedWorkflowRunId);
                  setActiveLens(sessionId, 'workflows');
                }}
              />
            ) : null}

            {!isBranchless ? (
              <div
                className={cn(
                  'absolute inset-0 z-10 flex flex-col',
                  !(lens === 'terminal' && showLens) && 'invisible pointer-events-none',
                )}
              >
                <TerminalDock
                  sessionId={sessionId}
                  isActive={isActive && lens === 'terminal' && showLens}
                  cwd={workingDir}
                />
              </div>
            ) : null}

            {studio != null ? (
              <div className="absolute inset-0 z-30">
                <SessionStudioLayer
                  session={session}
                  studio={studio}
                  onClose={() => setSessionStudio(sessionId, null)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
