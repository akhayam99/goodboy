import { useEffect, useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { KbdPill, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { PANE_RHYTHM } from '@goodboy/ui';
import { classifyAgent, isStandaloneAgent } from '../../../../agent-kind';
import { isAgentFinished } from '../../../../agent-lifecycle';
import { isPrReviewSession } from '../../../../../../store/slices/session-view';
import {
  EMPTY_ARRAY,
  useAppStore,
  useIsSessionCollectionLoaded,
  useLiveTerminalCount,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
  useSessionUnreadLens,
  useSummarizerStatus,
} from '../../../../../../store';
import type { LensKind } from '../../../../../../store';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { resolveAttentionLens, selectOpenQuestions } from '../../../SessionOverviewPane/lib';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { splitWorkflowRuns } from '../../../../../workflows/activeWorkflowRuns';
import { useActiveResolverCount } from '../../../../hooks/useActiveResolverCount';
import { buildLensNavigation } from './groups';
import type { LensDot, LensRow } from './groups';
import { rowsWantAttention } from './attention';
import { LensNavRow } from './LensNavRow';
import { resolveLensSurface } from '../../../../lens-surface';
import { CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { SIMPLE_LENSES } from '../../../../lens-labels';
import { shortcutGlyphs } from '../../../../../../shared/keyboard/registry';
import { useSettleElapsed } from '../../../../hooks/useSettleElapsed';

const LENS_COUNT_SETTLE_MS = 10_000;

type Props = {
  readonly session: Session;
  readonly filesCount: number;
  readonly diffstat?: {
    readonly additions: number;
    readonly deletions: number;
  };
  readonly isBranchless?: boolean;
};

export const LensNav = ({ session, filesCount, diffstat, isBranchless = false }: Props) => {
  const sessionId = session.id as SessionId;
  const storedActiveLens = useAppStore((s) => s.activeLens[sessionId] ?? null);
  const activeLens =
    isBranchless && storedActiveLens != null && !SIMPLE_LENSES.has(storedActiveLens)
      ? null
      : storedActiveLens;
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const loading = useAppStore((s) => s.sessionLoading[sessionId]);
  const fileVersions = useAppStore((s) => s.sessionFileVersions[sessionId] ?? EMPTY_ARRAY);
  const loadSessionFileVersions = useAppStore((s) => s.loadSessionFileVersions);
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const areAgentsLoading = loading?.agents === true;
  const arePlansLoading = loading?.plans === true;
  const areQuestionsKeyed = useAppStore((s) => s.sessionOpenQuestions[sessionId] !== undefined);
  const hasSettleElapsed = useSettleElapsed({ ms: LENS_COUNT_SETTLE_MS, resetKey: sessionId });
  const areWorkflowsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'workflows' });
  const areReviewDraftsLoaded = useIsSessionCollectionLoaded({
    sessionId,
    collection: 'reviewDrafts',
  });
  const areExternalTasksLoaded = useIsSessionCollectionLoaded({
    sessionId,
    collection: 'externalTasks',
  });
  const areFileVersionsLoaded = useIsSessionCollectionLoaded({
    sessionId,
    collection: 'fileVersions',
  });
  const isCountUnknown = (isLoaded: boolean): boolean => !isLoaded && !hasSettleElapsed;
  const areQuestionsLoading = isCountUnknown(areQuestionsKeyed);
  const openCount = selectOpenQuestions(useSessionOpenQuestions(sessionId)).length;
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const nonResolverStandalone = useNonResolverStandaloneAgents(sessionId);
  const activeNonResolverStandalone = useMemo(
    () => nonResolverStandalone.filter((agent) => !isAgentFinished({ agent })),
    [nonResolverStandalone],
  );
  const unreadLens = useSessionUnreadLens(sessionId);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const workspaceIntegrations = useAppStore(
    (s) => s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY,
  );
  const githubAuthentication = useGithubConnection({ workspaceId: session.workspaceId });

  const isResolver = useMemo(
    () => (agent: Agent) =>
      classifyAgent(agent, agentKindOverride[agent.id] ?? null) === 'resolver',
    [agentKindOverride],
  );

  const hasNonResolverStandalone = activeNonResolverStandalone.length > 0;
  const hasResolverAgent = useMemo(
    () => phaseRuns.some((a) => isStandaloneAgent(a) && isResolver(a)),
    [phaseRuns, isResolver],
  );
  const hasRunningAgent = useMemo(
    () => activeNonResolverStandalone.some((agent) => agent.status === 'running'),
    [activeNonResolverStandalone],
  );

  const attachedRuns = useAttachedWorkflowRuns({ session });
  const liveWorkflows = session.workflowRuns.filter((r) => r.discardedAt == null).length;
  const activeWorkflows = splitWorkflowRuns({ attachedRuns, agents: phaseRuns }).active.length;
  const attentionLens = resolveAttentionLens(useSessionStageInfo(session), {
    hasNonResolverStandalone,
    hasWorkflow: liveWorkflows > 0,
    hasResolver: hasResolverAgent,
    unreadLens,
  });
  const activePlans = useSessionPlans(sessionId).filter((p) => p.status === 'active').length;
  const runningScripts = useAppStore((s) => {
    const runs = s.scriptRuns[sessionId];
    if (!runs) {
      return 0;
    }
    return Object.values(runs).filter((r) => r.status === 'pending').length;
  });
  const liveTerminals = useLiveTerminalCount(sessionId);
  const summarizerStatus = useSummarizerStatus(sessionId).status;
  const summarizerDot: LensDot | undefined =
    summarizerStatus === 'running'
      ? 'running'
      : summarizerStatus === 'error'
        ? 'attention'
        : undefined;
  const branchlessVersionFileCount = useMemo(
    () => new Set(fileVersions.map((version) => version.relativePath)).size,
    [fileVersions],
  );

  useEffect(() => {
    if (!isBranchless) {
      return;
    }
    void loadSessionFileVersions({ sessionId });
  }, [isBranchless, loadSessionFileVersions, sessionId]);
  const hasGithubPr = useAppStore((s) => s.sessionGithub[sessionId]?.pr != null);
  const hasGitlabMr = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr != null);
  const openResolvers = useActiveResolverCount(sessionId);
  const hasPendingBatch = useAppStore(
    (s) => (s.sessionPendingResolutions[sessionId]?.length ?? 0) > 0,
  );
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  useEffect(() => {
    if (!isPrReview || areReviewDraftsLoaded) {
      return;
    }
    void loadReviewDrafts(sessionId);
  }, [isPrReview, areReviewDraftsLoaded, loadReviewDrafts, sessionId]);
  const reviewDraftCount = useAppStore(
    (s) =>
      (s.reviewDrafts[sessionId] ?? EMPTY_ARRAY).filter((draft) => draft.status === 'draft').length,
  );
  const githubCount =
    externalTasks.filter((task) => task.provider === 'github').length + (hasGithubPr ? 1 : 0);
  const linearCount = externalTasks.filter((task) => task.provider === 'linear').length;
  const sentryCount = externalTasks.filter((task) => task.provider === 'sentry').length;
  const gitlabCount = externalTasks.filter((task) => task.provider === 'gitlab').length;
  const jiraCount = externalTasks.filter((task) => task.provider === 'jira').length;
  const slackCount = externalTasks.filter((task) => task.provider === 'slack').length;
  const githubConnection = resolveIntegrationConnection({
    provider: 'github',
    integrations: workspaceIntegrations,
    externalTasks,
    isGithubAuthenticated:
      githubAuthentication.isResolved === false || githubAuthentication.isAuthenticated,
  });
  const linearConnection = resolveIntegrationConnection({
    provider: 'linear',
    integrations: workspaceIntegrations,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const sentryConnection = resolveIntegrationConnection({
    provider: 'sentry',
    integrations: workspaceIntegrations,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const gitlabConnection = resolveIntegrationConnection({
    provider: 'gitlab',
    integrations: workspaceIntegrations,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const jiraConnection = resolveIntegrationConnection({
    provider: 'jira',
    integrations: workspaceIntegrations,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const slackConnection = resolveIntegrationConnection({
    provider: 'slack',
    integrations: workspaceIntegrations,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const isGithubListed =
    githubAuthentication.isResolved && (githubConnection.isAvailable || hasGithubPr);
  const isGitlabListed = gitlabConnection.isAvailable || hasGitlabMr;
  const integrationRows: ReadonlyArray<LensRow> = [
    ...(isGithubListed
      ? [
          {
            kind: 'pr',
            label: 'GitHub',
            glyph: 'github',
            tone: CONCEPT_TONE.pr,
            count: githubCount,
            isCountLoading: isCountUnknown(areExternalTasksLoaded),
            secondaryDot: hasGithubPr,
            secondaryDotLabel: 'Pull request linked',
            isConnected: githubConnection.isConnected,
          } satisfies LensRow,
        ]
      : []),
    ...(isGitlabListed
      ? [
          {
            kind: 'gitlab_issues',
            label: 'GitLab',
            glyph: 'gitlab',
            tone: CONCEPT_TONE.gitlab,
            count: gitlabCount,
            isCountLoading: isCountUnknown(areExternalTasksLoaded),
            secondaryDot: hasGitlabMr,
            secondaryDotLabel: 'Merge request linked',
            isConnected: gitlabConnection.isConnected,
          } satisfies LensRow,
        ]
      : []),
    ...(jiraConnection.isAvailable
      ? [
          {
            kind: 'jira_issues',
            label: 'Jira',
            glyph: 'jira',
            tone: CONCEPT_TONE.jira,
            count: jiraCount,
            isCountLoading: isCountUnknown(areExternalTasksLoaded),
            isConnected: jiraConnection.isConnected,
          } satisfies LensRow,
        ]
      : []),
    ...(linearConnection.isAvailable
      ? [
          {
            kind: 'linear',
            label: 'Linear',
            glyph: 'linear',
            tone: CONCEPT_TONE.linear,
            count: linearCount,
            isCountLoading: isCountUnknown(areExternalTasksLoaded),
            isConnected: linearConnection.isConnected,
          } satisfies LensRow,
        ]
      : []),
    ...(sentryConnection.isAvailable
      ? [
          {
            kind: 'sentry',
            label: 'Sentry',
            glyph: 'sentry',
            tone: CONCEPT_TONE.sentry,
            count: sentryCount,
            isCountLoading: isCountUnknown(areExternalTasksLoaded),
            isConnected: sentryConnection.isConnected,
          } satisfies LensRow,
        ]
      : []),
    ...(slackConnection.isAvailable
      ? [
          {
            kind: 'slack_threads',
            label: 'Slack',
            glyph: 'slack',
            tone: CONCEPT_TONE.slack,
            count: slackCount,
            isCountLoading: isCountUnknown(areExternalTasksLoaded),
            isConnected: slackConnection.isConnected,
          } satisfies LensRow,
        ]
      : []),
  ];
  const sortedIntegrationRows: ReadonlyArray<LensRow> = [...integrationRows].sort((a, b) => {
    if (a.isConnected === false && b.isConnected !== false) {
      return 1;
    }
    if (b.isConnected === false && a.isConnected !== false) {
      return -1;
    }
    return 0;
  });

  const { primaryRows, groups } = buildLensNavigation({
    isBranchless,
    isPrReview,
    reviewDraftCount,
    activeWorkflows,
    attentionLens,
    unreadLens,
    agentCount: activeNonResolverStandalone.length,
    areAgentsLoading,
    hasRunningAgent,
    openResolvers,
    hasPendingBatch,
    openCount,
    areQuestionsLoading,
    filesCount: isBranchless ? branchlessVersionFileCount : filesCount,
    diffstat: isBranchless ? undefined : diffstat,
    activePlans,
    arePlansLoading,
    areWorkflowsLoading: isCountUnknown(areWorkflowsLoaded),
    areReviewDraftsLoading: isCountUnknown(areReviewDraftsLoaded),
    areFilesLoading: isBranchless && isCountUnknown(areFileVersionsLoaded),
    runningScripts,
    summarizerDot,
    liveTerminals,
    integrationRows: sortedIntegrationRows,
  });

  const activeSurface = resolveLensSurface({ lens: activeLens });
  const isOverviewActive = activeSurface === 'overview';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollFade className="min-h-0 flex-1">
        <nav className={cn('flex flex-col gap-4', PANE_RHYTHM.navRail.body)}>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setActiveLens(sessionId, null)}
              aria-current={isOverviewActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md text-left transition-colors',
                PANE_RHYTHM.navRail.row,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                isOverviewActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex w-5 flex-none items-center justify-center transition-[color,opacity]',
                  isOverviewActive ? 'opacity-100' : 'opacity-55 group-hover:opacity-80',
                )}
              >
                <LayoutDashboard size={14} aria-hidden />
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate pr-12 text-sm',
                  isOverviewActive && 'font-medium',
                )}
              >
                Overview
              </span>
              <KbdPill
                aria-hidden
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-3xs opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
              >
                {shortcutGlyphs('lens.overview')}
              </KbdPill>
            </button>
            {primaryRows.map((row) => (
              <LensNavRow
                key={row.kind}
                row={row}
                isActive={activeSurface === row.kind}
                onSelect={() => setActiveLens(sessionId, row.kind)}
              />
            ))}
          </div>
          {groups
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    'pb-1 text-3xs font-medium uppercase tracking-[0.12em] transition-colors',
                    PANE_RHYTHM.navRail.inset,
                    rowsWantAttention({ rows: group.rows })
                      ? 'text-foreground/80'
                      : 'text-muted-foreground/60',
                  )}
                >
                  {group.label}
                </span>
                {group.rows.map((row) => (
                  <LensNavRow
                    key={row.kind}
                    row={row}
                    isActive={activeSurface === row.kind}
                    onSelect={() => setActiveLens(sessionId, row.kind)}
                  />
                ))}
              </div>
            ))}
        </nav>
      </ScrollFade>
    </div>
  );
};
