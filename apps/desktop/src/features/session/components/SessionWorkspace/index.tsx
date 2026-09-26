import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { isAgentStatusSettled } from '@goodboy/core';
import { cn } from '@goodboy/ui';
import { TerminalDock } from '../../../terminal/components/TerminalDock';
import { ArtifactStudio } from '../../../artifacts/components/ArtifactStudio';
import { ScriptsPanel } from '../../../scripts';
import { EMPTY_ARRAY, useAppStore, useIsSessionCollectionLoaded } from '../../../../store';
import type { LensKind } from '../../../../store';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { SessionCrumbs } from '../SessionCrumbBar/SessionCrumbs';
import { PageCrumbContext } from '../../../../shared/components/PaneShell/PageCrumbContext';
import { AgentOverlay } from './parts/AgentOverlay';
import { AgentsPane } from './parts/AgentsPane';
import { Pane } from './parts/Pane';
import { SessionStudioLayer } from './parts/SessionStudioLayer';
import { QuestionsPane } from './parts/QuestionsPane';
import { ContextPane } from './parts/ContextPane';
import { PrPane } from './parts/PrPane';
import { FilesPane } from './parts/FilesPane';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useSessionBranchSync } from '../../hooks/useSessionBranchSync';
import { openLens } from '../../openLens';
import { resolveSessionSurfaceLayer } from './resolveSessionSurfaceLayer';
import { resolveDiffMount } from './parts/resolveDiffMount';
import { WorkflowsPane } from './parts/WorkflowsPane';
import { IntegrationPane } from './parts/IntegrationPane';
import { GithubTaskDetail } from './parts/IntegrationPane/GithubTaskDetail';
import { LinkTicketPopover } from './parts/IntegrationPane/LinkTicketPopover';
import { isStandaloneAgent, resolveRootAgent } from '../../agent-kind';
import { selectResolverAgentIds } from '../../../review/selectResolverAgentIds';
import { SessionOverviewLoading } from './parts/SessionOverviewLoading';
import { ReviewPane } from '../../../review/components/ReviewPane';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { useRemoteHostKind } from '../../../worktree/useRemoteHostKind';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { resolveActiveMountPath } from '../../../../store/slices/worktrees/resolveActiveMountPath';
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
  const storedActiveLens = useAppStore((s) => s.activeLens[sessionId]);
  const isBranchless = useIsBranchlessSession({ session });
  const activeLens =
    isBranchless && storedActiveLens != null && !SIMPLE_LENSES.has(storedActiveLens)
      ? null
      : storedActiveLens;
  const up = useAppStore((s) => s.up);
  const focusedGithubIssueNumber = useAppStore(
    (s) => s.focusedGithubIssueNumber[sessionId] ?? null,
  );
  const sessionExternalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const workingDir = useAppStore((s) => resolveActiveMountPath({ state: s, sessionId }));
  const sessionRepo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const projectWorktreePath = sessionRepo?.worktreePath ?? null;
  const sessionMounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const requestedDiffMountPath = useAppStore((s) => s.diffMountPath?.[sessionId] ?? null);
  const diffWorktreePath = resolveDiffMount({
    mounts: sessionMounts,
    requestedPath: requestedDiffMountPath,
    fallbackPath: projectWorktreePath,
  });
  const requestedTerminalMountPath = useAppStore((s) => s.terminalMountPath?.[sessionId] ?? null);
  const terminalWorkingDir = resolveDiffMount({
    mounts: sessionMounts,
    requestedPath: requestedTerminalMountPath,
    fallbackPath: workingDir,
  });
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const artifactConversationAgentId = useAppStore(
    (s) => s.artifactConversationAgentId[sessionId] ?? null,
  );
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const arePlansLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'plans' });
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);

  const githubPr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const gitlabMr = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr ?? null);
  const bitbucketPr = useAppStore((s) => s.sessionBitbucketPr[sessionId]?.pr ?? null);
  const remoteKind = useRemoteHostKind({ sessionId });
  const isGithubCodeHost =
    gitlabMr === null && bitbucketPr === null && (remoteKind === 'github' || githubPr !== null);

  const lens: LensKind | null = activeLens ?? null;
  const surface = resolveLensSurface({ lens });
  const isOverviewLoaded = areAgentsLoaded && arePlansLoaded;
  const isFreshOverviewLayout = session.workflowRuns.every((run) => run.discardedAt != null);
  const onRetryOverview = () => {
    void loadPhaseRunsForSession(sessionId);
    void loadSessionPlans(sessionId);
  };
  const onSelectLens = (next: LensKind) => {
    openLens({ sessionId, lens: next });
  };
  const onSelectOverview = () => {
    openLens({ sessionId, lens: null });
  };
  const surfaceLayer = resolveSessionSurfaceLayer({
    lens,
    hasStudio: studio != null,
    selectedAgentId,
    artifactConversationAgentId,
  });
  const showStudio = surfaceLayer === 'studio';
  const showAgentOverlay = surfaceLayer === 'agent';
  const showLens = surfaceLayer === 'lens';
  const resolverAgentIds = useMemo(
    () => selectResolverAgentIds({ agents: phaseRuns, kindOverride: agentKindOverride }),
    [phaseRuns, agentKindOverride],
  );
  const resolveAgentOrigin = useAppStore((s) => s.resolveAgentReturn[sessionId] ?? null);
  const returnFromResolveAgent = useAppStore((s) => s.returnFromResolveAgent);
  const githubTask = useMemo(
    () => sessionExternalTasks.find((task) => task.provider === 'github') ?? null,
    [sessionExternalTasks],
  );
  const githubIssueNumber =
    focusedGithubIssueNumber ?? (githubTask != null ? Number(githubTask.externalId) : null);
  const standaloneAgents = useMemo(
    () =>
      phaseRuns.filter((agent) => isStandaloneAgent({ agent }) && !resolverAgentIds.has(agent.id)),
    [phaseRuns, resolverAgentIds],
  );
  const agentCounts = useMemo(
    () => ({
      running: standaloneAgents.filter((agent) => agent.status === 'running').length,
      done: standaloneAgents.filter((agent) => isAgentStatusSettled({ status: agent.status }))
        .length,
      failed: standaloneAgents.filter((agent) => agent.status === 'failed').length,
    }),
    [standaloneAgents],
  );
  const agentsMeta =
    agentCounts.running === 0 && agentCounts.done === 0 && agentCounts.failed === 0
      ? undefined
      : `${agentCounts.running} running, ${agentCounts.done} done${
          agentCounts.failed > 0 ? `, ${agentCounts.failed} failed` : ''
        }`;
  const leaveAgentOverlay = useCallback(() => {
    if (resolveAgentOrigin !== null && resolveAgentOrigin.agentId === selectedAgentId) {
      returnFromResolveAgent({ sessionId });
      return;
    }
    up();
  }, [resolveAgentOrigin, returnFromResolveAgent, selectedAgentId, sessionId, up]);

  useEffect(() => {
    if (!showAgentOverlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      leaveAgentOverlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAgentOverlay, leaveAgentOverlay]);

  const crumb = useMemo(() => <SessionCrumbs session={session} />, [session]);

  return (
    <PageCrumbContext.Provider value={crumb}>
      <div className="@container relative flex h-full w-full min-w-0 flex-col">
        <div className="relative min-h-0 flex-1">
          <div
            className={cn('absolute inset-0 z-0', !showLens && 'invisible pointer-events-none')}
            inert={!showLens}
          >
            <PageCrumbContext.Provider value={showLens ? crumb : null}>
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
              {lens === 'plans' ? <ArtifactStudio sessionId={sessionId} /> : null}
              {lens === 'workflows' ? <WorkflowsPane session={session} /> : null}
              {lens === 'scripts' ? (
                <ScriptsPanel workspaceId={session.workspaceId} sessionId={sessionId} />
              ) : null}
              {surface === 'context' ? (
                <ContextPane session={session} initialRegion={contextRegionFor({ lens })} />
              ) : null}
              {lens === 'pr' && !isGithubCodeHost ? <PrPane session={session} /> : null}
              {lens === 'review' || (lens === 'pr' && isGithubCodeHost) ? (
                <ReviewPane session={session} />
              ) : null}
              {lens === 'linear' ? (
                <IntegrationPane
                  sessionId={sessionId}
                  workspaceId={session.workspaceId}
                  provider="linear"
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
                  <PaneShell title="GitHub issue">
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
                <PageCrumbContext.Provider value={showLens && lens === 'agents' ? crumb : null}>
                  <AgentsPane session={session} meta={agentsMeta} />
                </PageCrumbContext.Provider>
              </Pane>
            </PageCrumbContext.Provider>
          </div>

          {showAgentOverlay ? (
            <AgentOverlay
              session={session}
              sessionId={sessionId}
              isChatActive={isActive && selectedAgentId != null}
              selectedAgentId={selectedAgentId}
              onBack={leaveAgentOverlay}
            />
          ) : null}

          {!isBranchless ? (
            <div
              className={cn(
                'absolute inset-0 z-10 flex flex-col',
                !(lens === 'terminal' && showLens) && 'invisible pointer-events-none',
              )}
            >
              <PageCrumbContext.Provider value={lens === 'terminal' && showLens ? crumb : null}>
                <TerminalDock
                  sessionId={sessionId}
                  isActive={isActive && lens === 'terminal' && showLens}
                  cwd={terminalWorkingDir}
                />
              </PageCrumbContext.Provider>
            </div>
          ) : null}

          {studio != null ? (
            <div className="absolute inset-0 z-30">
              <SessionStudioLayer session={session} studio={studio} onClose={up} />
            </div>
          ) : null}
        </div>
      </div>
    </PageCrumbContext.Provider>
  );
};
