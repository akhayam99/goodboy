import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { TerminalDock } from '../../../terminal/components/TerminalDock';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ScriptsPanel } from '../../../scripts';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  readPersistedLens,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { SessionCrumbBar } from '../SessionCrumbBar';
import { RepoScopeBar } from './parts/RepoScopeBar';
import { AgentOverlay } from './parts/AgentOverlay';
import { AgentsPane } from './parts/AgentsPane';
import { Pane } from './parts/Pane';
import { SessionStudioLayer } from './parts/SessionStudioLayer';
import { QuestionsPane } from './parts/QuestionsPane';
import { ContextPane } from './parts/ContextPane';
import { TimelinePane } from './parts/TimelinePane';
import { ResolvePane } from './parts/ResolvePane';
import { PrPane } from './parts/PrPane';
import { FilesPane } from './parts/FilesPane';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useSelectedAgentHome } from './hooks/useSelectedAgentHome';
import { resolveOverlayHome } from './resolveOverlayHome';
import { WorkflowsPane } from './parts/WorkflowsPane';
import { IntegrationPane } from './parts/IntegrationPane';
import { GithubTaskDetail } from './parts/IntegrationPane/GithubTaskDetail';
import { LinkTicketPopover } from './parts/IntegrationPane/LinkTicketPopover';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { isStandaloneAgent, resolveRootAgent } from '../../agent-kind';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { SessionOverviewLoading } from './parts/SessionOverviewLoading';
import { ReviewBoardPane } from '../../../review/components/ReviewBoardPane';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { ExplorePane } from '../../../explore/components/ExplorePane';
import { LENS_LABEL, SIMPLE_LENSES } from '../../lens-labels';
import { contextRegionFor, resolveLensSurface } from '../../lens-surface';
import { LensEmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type SessionWorkspaceProps = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionWorkspace = ({ session, isActive }: SessionWorkspaceProps) => {
  const sessionId = session.id as SessionId;
  const [inspectedResolverId, setInspectedResolverId] = useState<AgentId | null>(null);
  const [inspectedAgentId, setInspectedAgentId] = useState<AgentId | null>(null);
  const hasInitializedResolverInspector = useRef(false);
  const hasInitializedAgentInspector = useRef(false);
  const storedActiveLens = useAppStore((s) => s.activeLens[sessionId]);
  const isBranchless = useIsBranchlessSession({ session });
  const activeLens =
    isBranchless && storedActiveLens != null && !SIMPLE_LENSES.has(storedActiveLens)
      ? null
      : storedActiveLens;
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const focusedGithubIssueNumber = useAppStore(
    (s) => s.focusedGithubIssueNumber[sessionId] ?? null,
  );
  const sessionExternalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
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
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const attachedWorkflowRuns = useAttachedWorkflowRuns({ session });
  const openQuestions = useSessionOpenQuestions(sessionId);
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const arePlansLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'plans' });
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);

  useEffect(() => {
    if (activeLens === undefined) {
      setActiveLens(sessionId, readPersistedLens(sessionId));
    }
  }, [activeLens, sessionId, setActiveLens]);

  const lens: LensKind | null = activeLens ?? null;
  const surface = resolveLensSurface({ lens });
  const isOverviewLoaded = areAgentsLoaded && arePlansLoaded;
  const isFreshOverviewLayout = session.workflowRuns.every((run) => run.discardedAt != null);
  const onRetryOverview = () => {
    void loadPhaseRunsForSession(sessionId);
    void loadSessionPlans(sessionId);
  };
  const onSelectLens = (next: LensKind) => {
    setActiveLens(sessionId, next);
  };
  const onSelectOverview = () => {
    setActiveLens(sessionId, null);
  };
  const showStudio = studio != null;
  const showAgentOverlay = selectedAgentId != null && !showStudio;
  const showLens = selectedAgentId == null && !showStudio;
  const resolverIndex = useResolverIndex(sessionId);
  const resolverAgentIds = useMemo(
    () => new Set(resolverIndex.links.map(({ agent }) => agent.id)),
    [resolverIndex],
  );
  const overlayHome = resolveOverlayHome({ lens, agentHome });
  const githubTask = useMemo(
    () => sessionExternalTasks.find((task) => task.provider === 'github') ?? null,
    [sessionExternalTasks],
  );
  const githubIssueNumber =
    focusedGithubIssueNumber ?? (githubTask != null ? Number(githubTask.externalId) : null);
  const selectedRootAgent = useMemo(() => {
    if (selectedAgentId == null) {
      return null;
    }
    return resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId });
  }, [phaseRuns, selectedAgentId]);
  const selectedWorkflowRunId = selectedRootAgent?.workflowRunId ?? null;
  const showWorkflowStrip =
    showAgentOverlay && overlayHome === 'workflows' && selectedWorkflowRunId != null;
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
    <div className="relative flex h-full w-full min-w-0 flex-col">
      <div
        className={cn(!showLens && 'pointer-events-none invisible absolute inset-x-0 top-0')}
        inert={!showLens}
      >
        <SessionCrumbBar />
        <RepoScopeBar sessionId={sessionId} />
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          className={cn('absolute inset-0 z-0', !showLens && 'invisible pointer-events-none')}
          inert={!showLens}
        >
          {surface === 'overview' ? (
            isOverviewLoaded ? (
              <SessionOverviewPane session={session} onSelectLens={onSelectLens} />
            ) : (
              <SessionOverviewLoading
                isFreshLayout={isFreshOverviewLayout}
                onRetry={onRetryOverview}
              />
            )
          ) : null}
          {lens === 'questions' ? <QuestionsPane session={session} /> : null}
          {lens === 'timeline' ? <TimelinePane session={session} /> : null}
          {lens === 'plans' ? <PlanStudio sessionId={sessionId} /> : null}
          {lens === 'workflows' ? <WorkflowsPane session={session} /> : null}
          {lens === 'resolve' ? (
            <ResolvePane
              session={session}
              meta={resolveMeta}
              inspectedResolverId={inspectedResolverId}
              onInspectResolver={setInspectedResolverId}
            />
          ) : null}
          {lens === 'scripts' ? (
            <PaneShell
              title="Scripts"
              description="Shell commands you run by hand from this session, no agent involved."
            >
              <ScriptsPanel
                workspaceId={session.workspaceId}
                sessionId={sessionId}
                worktreePath={workingDir}
                hasHostHeading
              />
            </PaneShell>
          ) : null}
          {surface === 'context' ? (
            <ContextPane session={session} initialRegion={contextRegionFor({ lens })} />
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
          {lens === 'jira_issues' ? (
            <IntegrationPane
              sessionId={sessionId}
              workspaceId={session.workspaceId}
              provider="jira"
            />
          ) : null}
          {lens === 'slack_threads' ? (
            <IntegrationPane
              sessionId={sessionId}
              workspaceId={session.workspaceId}
              provider="slack"
            />
          ) : null}
          {lens === 'github_issue' ? (
            githubIssueNumber != null ? (
              <GithubTaskDetail
                workspaceId={session.workspaceId}
                rootPath={projectWorktreePath}
                {...(githubTask != null && { task: githubTask })}
                issueNumber={githubIssueNumber}
              />
            ) : (
              <PaneShell
                title="GitHub issue"
                description="The GitHub issue linked to this session."
              >
                <LensEmptyState
                  icon={CONCEPT_ICONS.github}
                  tone={CONCEPT_TONE.github}
                  title="No GitHub issue linked"
                  description="Link a GitHub issue to this session to see it here."
                  action={
                    <LinkTicketPopover
                      sessionId={sessionId}
                      workspaceId={session.workspaceId}
                      provider="github"
                      providerLabel="GitHub"
                      noun="issue"
                      nounPhrase="an issue"
                      nounPlural="issues"
                    />
                  }
                />
              </PaneShell>
            )
          ) : null}
          {lens === 'files' ? (
            <FilesPane
              sessionId={sessionId}
              sessionDir={workingDir}
              worktreePath={projectWorktreePath}
              isBranchless={isBranchless}
              onClose={onSelectOverview}
            />
          ) : null}
          {lens === 'explore' ? (
            <ExplorePane sessionId={sessionId} sessionDir={workingDir} />
          ) : null}
          <Pane visible={lens === 'agents'}>
            <AgentsPane
              session={session}
              meta={agentsMeta}
              inspectedAgentId={inspectedAgentId}
              onInspectAgent={setInspectedAgentId}
            />
          </Pane>
        </div>

        {showAgentOverlay ? (
          <AgentOverlay
            session={session}
            sessionId={sessionId}
            isChatActive={isActive && selectedAgentId != null}
            selectedAgentId={selectedAgentId}
            overlayHome={overlayHome}
            overlayHomeLabel={LENS_LABEL[overlayHome]}
            showWorkflowStrip={showWorkflowStrip}
            onOverview={onSelectOverview}
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
  );
};
