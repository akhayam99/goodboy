import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  Bug,
  CheckCheck,
  CircleHelp,
  FileDiff,
  FileText,
  GitBranch,
  GitFork,
  LayoutDashboard,
  Layers,
  ListTodo,
  MessageSquareReply,
  SquareTerminal,
  Target,
  Terminal,
} from 'lucide-react';
import { KbdPill, ScrollFade, Skeleton, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { classifyAgent, isStandaloneAgent } from '../../../../session/agent-kind';
import {
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
  useSessionUnreadLens,
} from '../../../../../store';
import type { LensKind } from '../../../../../store';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { resolveAttentionLens, selectOpenQuestions } from '../../SessionOverviewPane/lib';

type LensColumnProps = {
  readonly session: Session;
  readonly activeLens: LensKind | null;
  readonly onSelectOverview: () => void;
  readonly onSelect: (lens: LensKind) => void;
  readonly filesCount: number;
};

type LensRow = {
  readonly kind: LensKind;
  readonly label: string;
  readonly icon: LucideIcon;
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
  const unreadLens = useSessionUnreadLens(sessionId);
  const remoteKind = useRemoteHostKind(session.workspaceId);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const hasGitlabIntegration = useAppStore((s) =>
    (s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY).some(
      (integration) => integration.provider === 'gitlab',
    ),
  );

  const isResolver = useMemo(
    () => (agent: Agent) =>
      classifyAgent(agent, agentKindOverride[agent.id] ?? null) === 'resolver',
    [agentKindOverride],
  );

  const hasNonResolverStandalone = nonResolverStandalone.length > 0;
  const hasResolverAgent = useMemo(
    () => phaseRuns.some((a) => isStandaloneAgent(a) && isResolver(a)),
    [phaseRuns, isResolver],
  );
  const hasRunningAgent = useMemo(
    () => nonResolverStandalone.some((agent) => agent.status === 'running'),
    [nonResolverStandalone],
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
  const terminalOpen = useAppStore((s) => s.terminalSessions[sessionId] === 'open');
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
  const linearCount = externalTasks.filter((task) => task.provider === 'linear').length;
  const sentryCount = externalTasks.filter((task) => task.provider === 'sentry').length;
  const gitlabCount = externalTasks.filter((task) => task.provider === 'gitlab').length;
  const isGitlabRemote = remoteKind === 'gitlab';
  const shouldShowGitlabIssues = remoteKind != null && !isGitlabRemote && hasGitlabIntegration;

  const groups: ReadonlyArray<LensGroup> = [
    {
      label: 'Work',
      rows: [
        {
          kind: 'workflows',
          label: 'Workflows',
          icon: Layers,
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
          count: nonResolverStandalone.length,
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
        { kind: 'goal', label: 'Goal', icon: Target, tone: 'primary' },
        { kind: 'decisions', label: 'Decisions', icon: CheckCheck, tone: 'success' },
        { kind: 'last_output_summary', label: 'Session summary', icon: Activity, tone: 'info' },
      ],
    },
    {
      label: 'Integrations',
      rows: [
        {
          kind: 'pr',
          label: isGitlabRemote ? 'GitLab' : 'GitHub',
          icon: isGitlabRemote ? GitFork : GitBranch,
          tone: 'accent',
          dot: hasPr ? 'running' : undefined,
        },
        { kind: 'linear', label: 'Linear', icon: ListTodo, tone: 'primary', count: linearCount },
        { kind: 'sentry', label: 'Sentry', icon: Bug, tone: 'warning', count: sentryCount },
        ...(shouldShowGitlabIssues
          ? [
              {
                kind: 'gitlab_issues',
                label: 'GitLab issues',
                icon: GitFork,
                tone: 'accent',
                count: gitlabCount,
              } satisfies LensRow,
            ]
          : []),
      ],
    },
    {
      label: 'Infra',
      rows: [
        {
          kind: 'terminal',
          label: 'Terminal',
          icon: SquareTerminal,
          tone: 'neutral',
          dot: terminalOpen ? 'running' : undefined,
        },
      ],
    },
  ];

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
          <span
            aria-hidden
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors',
              tintClasses('neutral').bg,
              tintClasses('neutral').ring,
            )}
          >
            <LayoutDashboard size={12} aria-hidden className={tintClasses('neutral').icon} />
          </span>
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
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              {group.label}
            </span>
            {group.rows.map((row) => {
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
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors',
                      tintClasses(row.tone).bg,
                      tintClasses(row.tone).ring,
                    )}
                  >
                    <row.icon size={12} aria-hidden className={tintClasses(row.tone).icon} />
                  </span>
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
            })}
          </div>
        ))}
      </nav>
    </ScrollFade>
  );
};
