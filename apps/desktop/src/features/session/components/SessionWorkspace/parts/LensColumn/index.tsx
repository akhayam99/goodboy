import { useEffect, useMemo } from 'react';
import { Kanban, LayoutDashboard, Unplug } from 'lucide-react';
import { Divider, KbdPill, ScrollFade, Skeleton, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { PANE_RHYTHM } from '../../../../../../shared/components/paneRhythm';
import { classifyAgent, isStandaloneAgent } from '../../../../agent-kind';
import { isAgentFinished } from '../../../../agent-lifecycle';
import { isPrReviewSession } from '../../../../../../store/slices/session-view';
import {
  EMPTY_ARRAY,
  useAppStore,
  useLiveTerminalCount,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
  useSessionUnreadLens,
  useSummarizerStatus,
} from '../../../../../../store';
import type { LensKind } from '../../../../../../store';
import { useRemoteHostKind } from '../../../../../worktree/useRemoteHostKind';
import { useSessionSidebarCollapsed } from '../../../../../workspace/hooks/useSessionSidebarVisibility/collapsed';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { resolveAttentionLens, selectOpenQuestions } from '../../../SessionOverviewPane/lib';
import { LensColumnFooter } from '../LensColumnFooter';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { splitWorkflowRuns } from '../../../../../workflows/activeWorkflowRuns';
import { useResolverIndex } from '../../../../hooks/useResolverIndex';
import { resolverLaneEntries } from '../../../ResolverAgentsLane/resolverLaneEntries';
import { LENS_SHORTCUTS, buildLensGroups } from './groups';
import type { LensDot, LensRow } from './groups';
import { CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../../../shared/keyboard/registry';

type Props = {
  readonly session: Session;
  readonly activeLens: LensKind | null;
  readonly onSelectOverview: () => void;
  readonly onSelect: (lens: LensKind) => void;
  readonly filesCount: number;
  readonly diffstat?: {
    readonly additions: number;
    readonly deletions: number;
  };
  readonly isBranchless?: boolean;
};

type AttentionParams = {
  readonly rows: ReadonlyArray<LensRow>;
};

const BOARD_ICON_BUTTON =
  'inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

const groupWantsAttention = ({ rows }: AttentionParams): boolean => {
  return rows.some((row) => {
    if (row.dot != null || row.secondaryDot === true) {
      return true;
    }
    if (row.count == null || row.count === 0) {
      return false;
    }
    return row.tone === 'warning' || row.tone === 'danger';
  });
};

export const LensColumn = ({
  session,
  activeLens,
  onSelectOverview,
  onSelect,
  filesCount,
  diffstat,
  isBranchless = false,
}: Props) => {
  const sessionId = session.id as SessionId;
  const isSidebarCollapsed = useSessionSidebarCollapsed();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const loading = useAppStore((s) => s.sessionLoading[sessionId]);
  const fileVersions = useAppStore((s) => s.sessionFileVersions[sessionId] ?? EMPTY_ARRAY);
  const loadSessionFileVersions = useAppStore((s) => s.loadSessionFileVersions);
  const areAgentsLoading = loading?.agents === true;
  const arePlansLoading = loading?.plans === true;
  const areQuestionsLoading = useAppStore((s) => s.sessionOpenQuestions[sessionId] === undefined);
  const openCount = selectOpenQuestions(useSessionOpenQuestions(sessionId)).length;
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const nonResolverStandalone = useNonResolverStandaloneAgents(sessionId);
  const activeNonResolverStandalone = useMemo(
    () => nonResolverStandalone.filter((agent) => !isAgentFinished({ agent })),
    [nonResolverStandalone],
  );
  const unreadLens = useSessionUnreadLens(sessionId);
  const remoteKind = useRemoteHostKind({ sessionId });
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
  const resolverIndex = useResolverIndex(sessionId);
  const openResolvers = useMemo(
    () => resolverLaneEntries({ links: resolverIndex.links }).active.length,
    [resolverIndex.links],
  );
  const hasPendingBatch = useAppStore(
    (s) => (s.sessionPendingResolutions[sessionId]?.length ?? 0) > 0,
  );
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  const reviewDraftCount = useAppStore(
    (s) =>
      (s.reviewDrafts[sessionId] ?? EMPTY_ARRAY).filter((draft) => draft.status === 'draft').length,
  );
  const githubCount =
    externalTasks.filter((task) => task.provider === 'github').length + (hasGithubPr ? 1 : 0);
  const linearCount = externalTasks.filter((task) => task.provider === 'linear').length;
  const sentryCount = externalTasks.filter((task) => task.provider === 'sentry').length;
  const gitlabCount = externalTasks.filter((task) => task.provider === 'gitlab').length;
  const githubConnection = resolveIntegrationConnection({
    provider: 'github',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
    isGithubAuthenticated:
      githubAuthentication.isResolved === false || githubAuthentication.isAuthenticated,
  });
  const linearConnection = resolveIntegrationConnection({
    provider: 'linear',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const sentryConnection = resolveIntegrationConnection({
    provider: 'sentry',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const gitlabConnection = resolveIntegrationConnection({
    provider: 'gitlab',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
    isGithubAuthenticated: false,
  });
  const integrationRows: ReadonlyArray<LensRow> = [
    {
      kind: 'pr',
      label: 'GitHub',
      glyph: 'github',
      tone: CONCEPT_TONE.pr,
      count: githubCount,
      secondaryDot: hasGithubPr,
      isConnected: githubConnection.isConnected,
    },
    {
      kind: 'gitlab_issues',
      label: 'GitLab',
      glyph: 'gitlab',
      tone: CONCEPT_TONE.gitlab,
      count: gitlabCount,
      secondaryDot: hasGitlabMr,
      isConnected: gitlabConnection.isConnected,
    },
    {
      kind: 'linear',
      label: 'Linear',
      glyph: 'linear',
      tone: CONCEPT_TONE.linear,
      count: linearCount,
      isConnected: linearConnection.isConnected,
    },
    {
      kind: 'sentry',
      label: 'Sentry',
      glyph: 'sentry',
      tone: CONCEPT_TONE.sentry,
      count: sentryCount,
      isConnected: sentryConnection.isConnected,
    },
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

  const visibleGroups = buildLensGroups({
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
    runningScripts,
    summarizerDot,
    liveTerminals,
    integrationRows: sortedIntegrationRows,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollFade className="min-h-0 flex-1">
        <nav className={cn('flex flex-col gap-4', PANE_RHYTHM.navRail.body)}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSelectOverview}
              aria-current={activeLens === null ? 'page' : undefined}
              className={cn(
                'group relative flex flex-1 items-center gap-2.5 rounded-md text-left transition-colors',
                PANE_RHYTHM.navRail.row,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                activeLens === null
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className="flex w-5 flex-none items-center justify-center transition-colors">
                <LayoutDashboard size={14} aria-hidden />
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate pr-12 text-sm',
                  activeLens === null && 'font-medium',
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
            {isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => void setCurrentSession(null)}
                aria-label="Back to board"
                title={`Back to board (${shortcutGlyphs('session.board')})`}
                className={BOARD_ICON_BUTTON}
              >
                <Kanban size={14} aria-hidden />
              </button>
            ) : null}
          </div>
          {visibleGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'pb-1 text-3xs font-medium uppercase tracking-[0.12em] transition-colors',
                  PANE_RHYTHM.navRail.inset,
                  groupWantsAttention({ rows: group.rows })
                    ? 'text-foreground/80'
                    : 'text-muted-foreground/60',
                )}
              >
                {group.label}
              </span>
              {group.rows.length === 0 ? (
                <></>
              ) : (
                group.rows.map((row) => {
                  const active = activeLens === row.kind;
                  const rowWantsAttention = groupWantsAttention({ rows: [row] });
                  const shortcut = shortcutGlyphs(LENS_SHORTCUTS[row.kind]);
                  const hasDiffstat =
                    row.diffstat != null && row.diffstat.additions + row.diffstat.deletions > 0;
                  const hasBadge =
                    row.isCountLoading === true ||
                    hasDiffstat ||
                    (row.count != null && row.count > 0) ||
                    row.dot != null ||
                    row.secondaryDot === true ||
                    row.isConnected === false;
                  const glyphRowLabel =
                    row.count != null && row.count > 0 ? `${row.label} ${row.count}` : row.label;
                  const iconEmphasis = cn(
                    active && 'opacity-100',
                    !active && rowWantsAttention ? 'opacity-90' : null,
                    !active && !rowWantsAttention ? 'opacity-55 group-hover:opacity-80' : null,
                  );
                  return (
                    <button
                      key={row.kind}
                      type="button"
                      onClick={() => onSelect(row.kind)}
                      aria-label={row.glyph != null ? glyphRowLabel : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-md text-left transition-colors',
                        PANE_RHYTHM.navRail.row,
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                        active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                        row.isConnected === false && 'opacity-40 hover:opacity-70',
                      )}
                    >
                      {row.glyph != null ? (
                        <span
                          className={cn(
                            'flex w-5 flex-none items-center justify-center transition-[color,opacity]',
                            iconEmphasis,
                          )}
                        >
                          <IntegrationGlyph
                            provider={row.glyph}
                            size={14}
                            useBrandColor={row.isConnected !== false}
                          />
                        </span>
                      ) : null}
                      {row.glyph == null && row.icon != null ? (
                        <span
                          className={cn(
                            'flex w-5 flex-none items-center justify-center transition-[color,opacity]',
                            tintClasses(row.tone ?? 'neutral').icon,
                            iconEmphasis,
                          )}
                        >
                          <row.icon size={14} aria-hidden />
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          !hasBadge && 'pr-12',
                          active && 'font-medium',
                        )}
                      >
                        {row.label}
                      </span>
                      {hasBadge ? (
                        <span
                          className={cn(
                            'flex min-w-10 shrink-0 items-center justify-end gap-1.5 transition-opacity',
                            'group-hover:opacity-0 group-focus-visible:opacity-0',
                          )}
                        >
                          {row.isCountLoading === true ? (
                            <span data-testid={`lens-count-loading-${row.kind}`}>
                              <Skeleton className="h-4 w-6 rounded-full" />
                            </span>
                          ) : (
                            <>
                              {hasDiffstat && row.diffstat != null ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs font-medium tabular-nums">
                                  <span className="text-success">+{row.diffstat.additions}</span>
                                  <span className="text-danger">-{row.diffstat.deletions}</span>
                                </span>
                              ) : row.count != null && row.count > 0 ? (
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {row.secondaryDot ? <StatusDot tone="accent" size="sm" /> : null}
                                  {row.dot === 'running' ? (
                                    <StatusDot tone="info" size="sm" pulsing />
                                  ) : null}
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-2xs font-medium tabular-nums',
                                      row.dot === 'attention'
                                        ? 'bg-warning/15 text-warning'
                                        : 'bg-muted text-muted-foreground',
                                    )}
                                  >
                                    {row.count}
                                  </span>
                                </span>
                              ) : row.dot ? (
                                <StatusDot
                                  tone={row.dot === 'attention' ? 'warning' : 'info'}
                                  size="sm"
                                  pulsing={row.dot === 'running'}
                                />
                              ) : row.secondaryDot ? (
                                <StatusDot tone="accent" size="sm" />
                              ) : null}
                              {row.isConnected === false ? (
                                <span
                                  aria-hidden
                                  title={`${row.label} disconnected`}
                                  className="flex shrink-0 items-center text-muted-foreground"
                                >
                                  <Unplug size={12} />
                                </span>
                              ) : null}
                            </>
                          )}
                        </span>
                      ) : null}
                      <KbdPill
                        aria-hidden
                        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-3xs opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
                      >
                        {shortcut}
                      </KbdPill>
                    </button>
                  );
                })
              )}
            </div>
          ))}
        </nav>
      </ScrollFade>
      <Divider />
      <LensColumnFooter session={session} />
    </div>
  );
};
