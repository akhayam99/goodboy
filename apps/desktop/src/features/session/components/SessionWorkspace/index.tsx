import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { TerminalDock } from '../../../terminal/components/TerminalDock';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ScriptsPanel } from '../../../scripts';
import {
  EMPTY_ARRAY,
  readPersistedLens,
  useAppStore,
  useIsSessionCollectionLoaded,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { SessionCrumbBar } from '../SessionCrumbBar';
import { AgentOverlay } from './parts/AgentOverlay';
import { AgentsPane } from './parts/AgentsPane';
import { Pane } from './parts/Pane';
import { SessionStudioLayer } from './parts/SessionStudioLayer';
import { QuestionsPane } from './parts/QuestionsPane';
import { ContextPane } from './parts/ContextPane';
import { ResolvePane } from './parts/ResolvePane';
import { PrPane } from './parts/PrPane';
import { FilesPane } from './parts/FilesPane';
import { ProjectsPane } from './parts/ProjectsPane';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useSelectedAgentHome } from '../../hooks/useSelectedAgentHome';
import { useSessionBranchSync } from '../../hooks/useSessionBranchSync';
import { resolveOverlayHome } from './resolveOverlayHome';
import { resolveDiffMount } from './parts/resolveDiffMount';
import { WorkflowsPane } from './parts/WorkflowsPane';
import { IntegrationPane } from './parts/IntegrationPane';
import { GithubTaskDetail } from './parts/IntegrationPane/GithubTaskDetail';
import { LinkTicketPopover } from './parts/IntegrationPane/LinkTicketPopover';
import { isStandaloneAgent, resolveRootAgent } from '../../agent-kind';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { SessionOverviewLoading } from './parts/SessionOverviewLoading';
import { ReviewBoardPane } from '../../../review/components/ReviewBoardPane';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { ExplorePane } from '../../../explore/components/ExplorePane';
import { SIMPLE_LENSES } from '../../lens-labels';
import { contextRegionFor, resolveLensSurface } from '../../lens-surface';
import { LensEmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type SessionWorkspaceProps = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionWorkspace = ({ session, isActive }: SessionWorkspaceProps) => {
  const sessionId = session.id as SessionId;
  useSessionBranchSync({ session, isActive });
  const [inspectedResolverId, setInspectedResolverId] = useState<AgentId | null>(null);
  const hasInitializedResolverInspector = useRef(false);
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
  const sessionMounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const requestedDiffMountPath = useAppStore((s) => s.diffMountPath?.[sessionId] ?? null);
  const diffWorktreePath = resolveDiffMount({
    mounts: sessionMounts,
    requestedPath: requestedDiffMountPath,
    fallbackPath: projectWorktreePath,
  });
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const setSessionStudio = useAppStore((s) => s.setSessionStudio);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
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
      <div>
        <SessionCrumbBar />
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
          {lens === 'projects' ? <ProjectsPane session={session} /> : null}
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
              worktreePath={diffWorktreePath}
              isBranchless={isBranchless}
              onClose={onSelectOverview}
            />
          ) : null}
          {lens === 'explore' ? (
            <ExplorePane sessionId={sessionId} sessionDir={workingDir} />
          ) : null}
          <Pane visible={lens === 'agents'}>
            <AgentsPane session={session} meta={agentsMeta} />
          </Pane>
        </div>

        {showAgentOverlay ? (
          <AgentOverlay
            session={session}
            sessionId={sessionId}
            isChatActive={isActive && selectedAgentId != null}
            selectedAgentId={selectedAgentId}
            onBack={() => setActiveLens(sessionId, overlayHome)}
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
