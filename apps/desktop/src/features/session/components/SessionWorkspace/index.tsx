import { useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import { ChatView } from '../../../chat/components/ChatView';
import { TerminalDock } from '../../../terminal/components/TerminalDock';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ScriptsPanel } from '../../../scripts';
import {
  EMPTY_ARRAY,
  readPersistedLens,
  useAppStore,
  useFilesTouched,
  useSessionPlans,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { worktreeStatus } from '../../../worktree/worktree';
import { AgentsSection } from '../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { AppBreadcrumb } from '../../../../app/components/AppBreadcrumb';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { SessionStudioLayer } from './parts/SessionStudioLayer';
import { SessionTopBar } from './parts/SessionTopBar';
import { LensColumn } from './parts/LensColumn';
import { QuestionsPane } from './parts/QuestionsPane';
import { SlotPane } from './parts/SlotPane';
import { PrPane } from './parts/PrPane';
import { FilesPane } from './parts/FilesPane';
import { PaneShell } from './parts/PaneShell';
import { useSelectedAgentHome } from './hooks/useSelectedAgentHome';
import { buildSessionBreadcrumb } from './sessionBreadcrumb';
import { ChatWorkflowHeader } from './parts/ChatWorkflowHeader';
import { WorkflowsPane } from './parts/WorkflowsPane';
import { IntegrationPane } from './parts/IntegrationPane';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { resolveRootAgent } from '../../agent-kind';
import { ForceResolveAction } from '../ForceResolveAction';
import { canForceResolve } from '../ForceResolveAction/canForceResolve';
import { useResolverIndex } from '../../hooks/useResolverIndex';

const LENS_LABEL: Record<LensKind, string> = {
  questions: 'Questions',
  agents: 'Agents',
  workflows: 'Workflows',
  resolve: 'Resolve',
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

type SessionWorkspaceProps = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const SessionWorkspace = ({ session, isActive }: SessionWorkspaceProps) => {
  const sessionId = session.id as SessionId;
  const activeLens = useAppStore((s) => s.activeLens[sessionId]);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const agentHome = useSelectedAgentHome(sessionId);
  const workingDir = useAppStore((s) => (s.sessionWorktrees[sessionId] ?? [])[0] ?? null);
  const studio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const setSessionStudio = useAppStore((s) => s.setSessionStudio);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  const filesTouched = useFilesTouched(sessionId, isActive);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const attachedWorkflowRuns = useAttachedWorkflowRuns({ session });
  const plans = useSessionPlans(sessionId);

  useEffect(() => {
    if (activeLens === undefined) {
      setActiveLens(sessionId, readPersistedLens(sessionId));
    }
  }, [activeLens, sessionId, setActiveLens]);

  useEffect(() => {
    if (!isActive || !workingDir) return;
    let cancelled = false;
    worktreeStatus(workingDir)
      .then((status) => {
        if (!cancelled && status.branch) {
          void reconcileSessionBranch(sessionId, status.branch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isActive, workingDir, sessionId, filesTouched.count, reconcileSessionBranch]);

  const lens: LensKind | null = activeLens ?? null;
  const onSelectLens = (next: LensKind) => {
    setActiveLens(sessionId, next);
  };
  const onSelectOverview = () => {
    setActiveLens(sessionId, null);
  };
  const showStudio = studio != null;
  const showAgentOverlay = selectedAgentId != null && !showStudio;
  const showLens = selectedAgentId == null && !showStudio;
  const overlayHome = agentHome ?? 'agents';
  const selectedAgent = useMemo(
    () => phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null,
    [phaseRuns, selectedAgentId],
  );
  const selectedAgentName = selectedAgent?.name ?? (selectedAgentId != null ? 'Agent' : null);
  const showWorkflowStrip = showAgentOverlay && selectedAgent?.workflowRunId != null;
  const selectedThreadId = selectedAgent?.sourceThreadId ?? null;
  const resolverIndex = useResolverIndex(sessionId);
  const selectedResolverLink =
    selectedThreadId == null ? undefined : resolverIndex.byThreadId.get(selectedThreadId);
  const selectedResolverStatus =
    selectedResolverLink?.agent.id === selectedAgentId ? selectedResolverLink.status : null;
  const selectedTurnState = useAppStore((state) =>
    selectedAgentId == null ? undefined : state.agentTurnState[selectedAgentId],
  );
  const showForceResolveHeader =
    showAgentOverlay &&
    overlayHome === 'resolve' &&
    selectedAgent != null &&
    selectedResolverStatus != null &&
    canForceResolve({
      agent: selectedAgent,
      status: selectedResolverStatus,
      turnState: selectedTurnState,
    });
  const stripWorkflowName = useMemo(() => {
    if (selectedAgentId == null) {
      return null;
    }
    const rootAgent = resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId });
    if (rootAgent?.workflowRunId == null) {
      return null;
    }
    const attachedRun = attachedWorkflowRuns.find(({ run }) => run.id === rootAgent.workflowRunId);
    return attachedRun == null ? null : workflowKindName(attachedRun.workflow);
  }, [attachedWorkflowRuns, phaseRuns, selectedAgentId]);
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
        selectedAgentName,
        overlayHomeLens: overlayHome,
        suppressAgentTail: showWorkflowStrip,
        stripWorkflowName,
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
      selectedAgentName,
      overlayHome,
      showWorkflowStrip,
      stripWorkflowName,
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
      <div className="flex min-w-0 shrink-0 items-center px-6 py-2.5">
        <AppBreadcrumb crumbs={crumbs} />
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-60 shrink-0 flex-col bg-background">
          <LensColumn
            session={session}
            activeLens={lens}
            onSelectOverview={onSelectOverview}
            onSelect={onSelectLens}
            filesCount={filesTouched.count}
          />
        </div>
        <Divider orientation="vertical" />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {showLens ? (
              <div className="absolute inset-0 z-0">
                {lens === null ? (
                  <SessionOverviewPane session={session} onSelectLens={onSelectLens} />
                ) : null}
                {lens === 'questions' ? <QuestionsPane session={session} /> : null}
                {lens === 'plans' ? (
                  <PlanStudio sessionId={sessionId} initialPlanId={focusedPlanId ?? undefined} />
                ) : null}
                {lens === 'workflows' ? <WorkflowsPane session={session} /> : null}
                {lens === 'resolve' ? (
                  <PaneShell
                    title="Resolve"
                    description="Resolver agents spawned from pull request comments and diff selections."
                    width="3xl"
                  >
                    <AgentsSection task={session} only="resolve" />
                  </PaneShell>
                ) : null}
                {lens === 'scripts' ? (
                  <PaneShell title="Scripts" width="3xl">
                    <ScriptsPanel
                      workspaceId={session.workspaceId}
                      sessionId={sessionId}
                      worktreePath={workingDir}
                    />
                  </PaneShell>
                ) : null}
                {lens === 'goal' || lens === 'decisions' || lens === 'last_output_summary' ? (
                  <SlotPane session={session} slotKey={lens} />
                ) : null}
                {lens === 'pr' ? <PrPane session={session} /> : null}
                {lens === 'linear' ? (
                  <IntegrationPane sessionId={sessionId} provider="linear" />
                ) : null}
                {lens === 'sentry' ? (
                  <IntegrationPane sessionId={sessionId} provider="sentry" />
                ) : null}
                {lens === 'gitlab_issues' ? (
                  <IntegrationPane sessionId={sessionId} provider="gitlab" />
                ) : null}
                {lens === 'files' ? (
                  <FilesPane
                    sessionId={sessionId}
                    workingDir={workingDir}
                    onClose={onSelectOverview}
                  />
                ) : null}
                <Pane visible={lens === 'agents'}>
                  <PaneShell
                    title="Agents"
                    description="Agents you spawn by hand to work this session."
                    width="3xl"
                  >
                    <AgentsSection task={session} only="agents" />
                  </PaneShell>
                </Pane>
              </div>
            ) : null}

            {showAgentOverlay ? (
              <div className="absolute inset-0 z-20 flex bg-background motion-safe:animate-studio-in">
                {overlayHome === 'workflows' ? null : (
                  <>
                    <div className="flex w-72 shrink-0 flex-col bg-background">
                      <button
                        type="button"
                        onClick={() => setActiveLens(sessionId, overlayHome)}
                        className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      >
                        <ArrowLeft size={14} aria-hidden className="shrink-0" />
                        <span className="truncate">{LENS_LABEL[overlayHome]}</span>
                      </button>
                      <Divider />
                      <ScrollFade className="min-h-0 flex-1">
                        <div className="px-2 py-2">
                          <AgentsSection task={session} only={overlayHome} />
                        </div>
                      </ScrollFade>
                    </div>
                    <Divider orientation="vertical" />
                  </>
                )}
                <div className="min-h-0 min-w-0 flex-1">
                  <ChatView
                    session={session}
                    isActive={isActive && selectedAgentId != null}
                    header={
                      showWorkflowStrip && selectedAgentId != null ? (
                        <ChatWorkflowHeader
                          sessionId={sessionId}
                          session={session}
                          selectedAgentId={selectedAgentId}
                        />
                      ) : showForceResolveHeader &&
                        selectedAgent != null &&
                        selectedResolverStatus != null ? (
                        <>
                          <div className="flex h-[var(--chat-header-h)] shrink-0 items-center justify-end px-3">
                            <ForceResolveAction
                              agent={selectedAgent}
                              sessionId={sessionId}
                              status={selectedResolverStatus}
                            />
                          </div>
                          <Divider className="shrink-0" />
                        </>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            ) : null}

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

type PaneProps = {
  readonly visible: boolean;
  readonly children: React.ReactNode;
};

const Pane = ({ visible, children }: PaneProps) => (
  <div hidden={!visible} className={cn('absolute inset-0', !visible && 'pointer-events-none')}>
    {children}
  </div>
);
