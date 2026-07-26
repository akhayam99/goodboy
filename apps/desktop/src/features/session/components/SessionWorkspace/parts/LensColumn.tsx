import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  CheckCheck,
  CircleHelp,
  FileDiff,
  MessageSquareDiff,
  FileText,
  LayoutDashboard,
  MessageSquareReply,
  Plug,
  SquareTerminal,
  Target,
  Terminal,
} from 'lucide-react';
import { IconTile, KbdPill, ScrollFade, Skeleton, StatusDot, cn } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { Agent, Session, SessionId, WorkspaceKind } from '@goodboy/types';
import { SECTION_ICONS } from '../../../../../shared/components/section-icons';
import { classifyAgent, isStandaloneAgent } from '../../../../session/agent-kind';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
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
} from '../../../../../store';
import type { LensKind } from '../../../../../store';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { resolveIntegrationConnection } from '../../../../integrations/connection';
import {
  IntegrationGlyph,
  type IntegrationGlyphProvider,
} from '../../../../integrations/components/IntegrationGlyph';
import { resolveAttentionLens, selectOpenQuestions } from '../../SessionOverviewPane/lib';

type LensColumnProps = {
  readonly session: Session;
  readonly activeLens: LensKind | null;
  readonly onSelectOverview: () => void;
  readonly onSelect: (lens: LensKind) => void;
  readonly filesCount: number;
  readonly workspaceKind?: WorkspaceKind;
};

type LensRow = {
  readonly kind: LensKind;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly glyph?: IntegrationGlyphProvider;
  readonly tone: Tone;
  readonly count?: number;
  readonly isCountLoading?: boolean;
  readonly dot?: 'attention' | 'running';
  readonly secondaryDot?: boolean;
};

type LensGroup = {
  readonly label: string;
  readonly rows: ReadonlyArray<LensRow>;
};

const LENS_SHORTCUTS = {
  questions: '⌘⇧Q',
  agents: '⌘⇧B',
  workflows: '⌘⇧W',
  resolve: '⌘⇧R',
  review: null,
  plans: '⌘⇧L',
  scripts: '⌘⇧S',
  terminal: '⌘J',
  goal: '⌘⇧G',
  decisions: '⌘⇧E',
  last_output_summary: '⌘⇧U',
  pr: '⌘⇧H',
  files: '⌘⇧D',
  linear: null,
  sentry: null,
  gitlab_issues: null,
} satisfies Readonly<Record<LensKind, string | null>>;

export const LensColumn = ({
  session,
  activeLens,
  onSelectOverview,
  onSelect,
  filesCount,
  workspaceKind = 'repo',
}: LensColumnProps) => {
  const sessionId = session.id as SessionId;
  const loading = useAppStore((s) => s.sessionLoading[sessionId]);
  const areAgentsLoading = loading?.agents === true;
  const arePlansLoading = loading?.plans === true;
  const areQuestionsLoading = useAppStore((s) => s.sessionOpenQuestions[sessionId] === undefined);
  const openCount = selectOpenQuestions(useSessionOpenQuestions(sessionId)).length;
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const nonResolverStandalone = useNonResolverStandaloneAgents(sessionId);
  const activeNonResolverStandalone = useMemo(
    () => nonResolverStandalone.filter((agent) => agent.doneAt == null),
    [nonResolverStandalone],
  );
  const unreadLens = useSessionUnreadLens(sessionId);
  const remoteKind = useRemoteHostKind(session.workspaceId);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const workspaceIntegrations = useAppStore(
    (s) => s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY,
  );

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

  const activeWorkflows = session.workflowRuns.filter((r) => r.discardedAt == null).length;
  const attentionLens = resolveAttentionLens(useSessionStageInfo(session), {
    hasNonResolverStandalone,
    hasWorkflow: activeWorkflows > 0,
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
  const summarizerDot: LensRow['dot'] =
    summarizerStatus === 'running'
      ? 'running'
      : summarizerStatus === 'error'
        ? 'attention'
        : undefined;
  const hasPr = useAppStore(
    (s) => s.sessionGithub[sessionId]?.pr != null || s.sessionGitlabMr[sessionId]?.mr != null,
  );
  const openResolvers = useMemo(
    () =>
      phaseRuns.reduce(
        (n, r) =>
          n +
          (isStandaloneAgent(r) &&
          isResolver(r) &&
          (r.status === 'pending' || r.status === 'running')
            ? 1
            : 0),
        0,
      ),
    [phaseRuns, isResolver],
  );
  const hasPendingBatch = useAppStore(
    (s) => (s.sessionPendingResolutions[sessionId]?.length ?? 0) > 0,
  );
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  const reviewDraftCount = useAppStore(
    (s) =>
      (s.reviewDrafts[sessionId] ?? EMPTY_ARRAY).filter((draft) => draft.status === 'draft').length,
  );
  const linearCount = externalTasks.filter((task) => task.provider === 'linear').length;
  const sentryCount = externalTasks.filter((task) => task.provider === 'sentry').length;
  const gitlabCount = externalTasks.filter((task) => task.provider === 'gitlab').length;
  const isGitlabRemote = remoteKind === 'gitlab';
  const prConnection = resolveIntegrationConnection({
    provider: 'pr',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
  });
  const linearConnection = resolveIntegrationConnection({
    provider: 'linear',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
  });
  const sentryConnection = resolveIntegrationConnection({
    provider: 'sentry',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
  });
  const gitlabConnection = resolveIntegrationConnection({
    provider: 'gitlab',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
  });
  const integrationRows: ReadonlyArray<LensRow> = [
    ...(prConnection.isAvailable
      ? [
          {
            kind: 'pr',
            label: isGitlabRemote ? 'GitLab' : 'GitHub',
            glyph: isGitlabRemote ? 'gitlab' : 'github',
            tone: 'accent',
            dot: hasPr ? 'running' : undefined,
          } satisfies LensRow,
        ]
      : []),
    ...(linearConnection.isAvailable
      ? [
          {
            kind: 'linear',
            label: 'Linear',
            glyph: 'linear',
            tone: 'primary',
            count: linearCount,
          } satisfies LensRow,
        ]
      : []),
    ...(sentryConnection.isAvailable
      ? [
          {
            kind: 'sentry',
            label: 'Sentry',
            glyph: 'sentry',
            tone: 'warning',
            count: sentryCount,
          } satisfies LensRow,
        ]
      : []),
    ...(gitlabConnection.isAvailable
      ? [
          {
            kind: 'gitlab_issues',
            label: 'GitLab issues',
            glyph: 'gitlab',
            tone: 'accent',
            count: gitlabCount,
          } satisfies LensRow,
        ]
      : []),
  ];

  const repoGroups: ReadonlyArray<LensGroup> = [
    {
      label: 'Work',
      rows: [
        ...(isPrReview
          ? [
              {
                kind: 'review',
                label: 'Review board',
                icon: MessageSquareDiff,
                tone: 'primary',
                count: reviewDraftCount,
              } satisfies LensRow,
            ]
          : []),
        {
          kind: 'workflows',
          label: 'Workflows',
          icon: SECTION_ICONS.workflows,
          tone: 'accent',
          count: activeWorkflows,
          dot:
            attentionLens === 'workflows' || unreadLens === 'workflows' ? 'attention' : undefined,
        },
        {
          kind: 'agents',
          label: 'Agents',
          icon: Bot,
          tone: 'primary',
          count: activeNonResolverStandalone.length,
          isCountLoading: areAgentsLoading,
          dot:
            attentionLens === 'agents' || unreadLens === 'agents'
              ? 'attention'
              : hasRunningAgent
                ? 'running'
                : undefined,
        },
        {
          kind: 'resolve',
          label: 'Resolve',
          icon: MessageSquareReply,
          tone: 'success',
          count: openResolvers,
          isCountLoading: areAgentsLoading,
          dot: attentionLens === 'resolve' || unreadLens === 'resolve' ? 'attention' : undefined,
          secondaryDot: hasPendingBatch,
        },
        {
          kind: 'questions',
          label: 'Questions',
          icon: CircleHelp,
          tone: 'warning',
          count: openCount,
          isCountLoading: areQuestionsLoading,
        },
        { kind: 'files', label: 'Diff', icon: FileDiff, tone: 'info', count: filesCount },
      ],
    },
    {
      label: 'Artifacts',
      rows: [
        {
          kind: 'plans',
          label: 'Plans',
          icon: FileText,
          tone: 'success',
          count: activePlans,
          isCountLoading: arePlansLoading,
        },
        { kind: 'scripts', label: 'Scripts', icon: Terminal, tone: 'info', count: runningScripts },
      ],
    },
    {
      label: 'Context',
      rows: [
        { kind: 'goal', label: 'Goal', icon: Target, tone: 'primary', dot: summarizerDot },
        {
          kind: 'decisions',
          label: 'Decisions',
          icon: CheckCheck,
          tone: 'success',
          dot: summarizerDot,
        },
        {
          kind: 'last_output_summary',
          label: 'Session summary',
          icon: Activity,
          tone: 'info',
          dot: summarizerDot,
        },
      ],
    },
    {
      label: 'Integrations',
      rows: integrationRows,
    },
    {
      label: 'Infra',
      rows: [
        {
          kind: 'terminal',
          label: 'Terminal',
          icon: SquareTerminal,
          tone: 'neutral',
          count: liveTerminals,
          dot: liveTerminals > 0 ? 'running' : undefined,
        },
      ],
    },
  ];
  const simpleGroups: ReadonlyArray<LensGroup> = [
    {
      label: 'Work',
      rows: [
        {
          kind: 'workflows',
          label: 'Workflows',
          icon: SECTION_ICONS.workflows,
          tone: 'accent',
          count: activeWorkflows,
          dot:
            attentionLens === 'workflows' || unreadLens === 'workflows' ? 'attention' : undefined,
        },
        {
          kind: 'agents',
          label: 'Agents',
          icon: Bot,
          tone: 'primary',
          count: activeNonResolverStandalone.length,
          isCountLoading: areAgentsLoading,
          dot:
            attentionLens === 'agents' || unreadLens === 'agents'
              ? 'attention'
              : hasRunningAgent
                ? 'running'
                : undefined,
        },
        {
          kind: 'questions',
          label: 'Questions',
          icon: CircleHelp,
          tone: 'warning',
          count: openCount,
          isCountLoading: areQuestionsLoading,
        },
      ],
    },
    {
      label: 'Artifacts',
      rows: [
        {
          kind: 'plans',
          label: 'Plans',
          icon: FileText,
          tone: 'success',
          count: activePlans,
          isCountLoading: arePlansLoading,
        },
      ],
    },
    {
      label: 'Context',
      rows: [
        { kind: 'goal', label: 'Goal', icon: Target, tone: 'primary', dot: summarizerDot },
        {
          kind: 'decisions',
          label: 'Decisions',
          icon: CheckCheck,
          tone: 'success',
          dot: summarizerDot,
        },
        {
          kind: 'last_output_summary',
          label: 'Session summary',
          icon: Activity,
          tone: 'info',
          dot: summarizerDot,
        },
      ],
    },
  ];
  const groups = workspaceKind === 'simple' ? simpleGroups : repoGroups;
  const visibleGroups = groups.filter(
    (group) => group.rows.length > 0 || group.label === 'Integrations',
  );

  return (
    <ScrollFade className="min-h-0 flex-1">
      <nav className="flex flex-col gap-4 px-2 py-3">
        <button
          type="button"
          onClick={onSelectOverview}
          aria-current={activeLens === null ? 'page' : undefined}
          className={cn(
            'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            activeLens === null
              ? 'bg-foreground/[0.06] text-foreground'
              : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground',
          )}
        >
          <IconTile size="xs" tone="neutral" className="transition-colors">
            <LayoutDashboard size={12} aria-hidden />
          </IconTile>
          <span
            className={cn(
              'min-w-0 flex-1 truncate pr-12 text-[13px]',
              activeLens === null && 'font-medium',
            )}
          >
            Overview
          </span>
          <KbdPill
            aria-hidden
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
          >
            ⌘⇧O
          </KbdPill>
        </button>
        {visibleGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              {group.label}
            </span>
            {group.rows.length === 0 ? (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('goodboy:open-workspace-settings', {
                      detail: { section: 'integrations' },
                    }),
                  )
                }
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-muted-foreground transition-colors',
                  'hover:bg-foreground/[0.03] hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                )}
              >
                <IconTile size="xs" tone="neutral" className="transition-colors">
                  <Plug size={12} aria-hidden />
                </IconTile>
                <span className="min-w-0 flex-1 truncate text-[13px]">Connect an integration</span>
              </button>
            ) : (
              group.rows.map((row) => {
                const active = activeLens === row.kind;
                const shortcut = LENS_SHORTCUTS[row.kind];
                const hasBadge =
                  row.isCountLoading === true ||
                  (row.count != null && row.count > 0) ||
                  row.dot != null ||
                  row.secondaryDot === true;
                return (
                  <button
                    key={row.kind}
                    type="button"
                    onClick={() => onSelect(row.kind)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                      active
                        ? 'bg-foreground/[0.06] text-foreground'
                        : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground',
                    )}
                  >
                    {row.glyph ? (
                      <IconTile
                        size="xs"
                        color={`var(--color-provider-${row.glyph})`}
                        ring
                        className="transition-colors"
                      >
                        <span aria-hidden>
                          <IntegrationGlyph provider={row.glyph} />
                        </span>
                      </IconTile>
                    ) : row.icon ? (
                      <IconTile size="xs" tone={row.tone} className="transition-colors">
                        <row.icon size={12} aria-hidden />
                      </IconTile>
                    ) : null}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[13px]',
                        shortcut != null && !hasBadge && 'pr-12',
                        active && 'font-medium',
                      )}
                    >
                      {row.label}
                    </span>
                    {hasBadge ? (
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-1.5 transition-opacity',
                          shortcut != null &&
                            'min-w-10 justify-end group-hover:opacity-0 group-focus-visible:opacity-0',
                        )}
                      >
                        {row.isCountLoading === true ? (
                          <span data-testid={`lens-count-loading-${row.kind}`}>
                            <Skeleton className="h-4 w-6 rounded-full" />
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
                      </span>
                    ) : null}
                    {shortcut != null ? (
                      <KbdPill
                        aria-hidden
                        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
                      >
                        {shortcut}
                      </KbdPill>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        ))}
      </nav>
    </ScrollFade>
  );
};
