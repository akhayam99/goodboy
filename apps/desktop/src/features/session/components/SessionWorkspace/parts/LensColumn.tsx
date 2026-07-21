import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  CheckCheck,
  CircleHelp,
  FileDiff,
  FileText,
  GitPullRequest,
  Layers,
  MessageSquareReply,
  SquareTerminal,
  Target,
  Terminal,
} from 'lucide-react';
import { ScrollFade, StatusDot, cn, tintClasses } from '@goodboy/ui';
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
import { resolveAttentionLens, selectOpenQuestions } from '../../SessionOverviewPane/lib';

type LensColumnProps = {
  readonly session: Session;
  readonly activeLens: LensKind | null;
  readonly onSelect: (lens: LensKind) => void;
  readonly filesCount: number;
};

type LensRow = {
  readonly kind: LensKind;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly count?: number;
  readonly dot?: 'attention' | 'running';
  readonly secondaryDot?: boolean;
};

type LensGroup = {
  readonly label: string;
  readonly rows: ReadonlyArray<LensRow>;
};

export const LensColumn = ({ session, activeLens, onSelect, filesCount }: LensColumnProps) => {
  const sessionId = session.id as SessionId;
  const openCount = selectOpenQuestions(useSessionOpenQuestions(sessionId)).length;
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const nonResolverStandalone = useNonResolverStandaloneAgents(sessionId);
  const unreadLens = useSessionUnreadLens(sessionId);

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

  const contextRows: ReadonlyArray<LensRow> = [
    { kind: 'goal', label: 'Goal', icon: Target, tone: 'primary' },
    { kind: 'decisions', label: 'Decisions', icon: CheckCheck, tone: 'success' },
    { kind: 'last_output_summary', label: 'Session summary', icon: Activity, tone: 'info' },
    {
      kind: 'pr',
      label: 'Pull request',
      icon: GitPullRequest,
      tone: 'accent',
      dot: hasPr ? 'running' : undefined,
    },
    {
      kind: 'questions',
      label: 'Questions',
      icon: CircleHelp,
      tone: 'warning',
      count: openCount,
    },
  ];

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
          dot: attentionLens === 'resolve' || unreadLens === 'resolve' ? 'attention' : undefined,
          secondaryDot: hasPendingBatch,
        },
        { kind: 'files', label: 'Diff', icon: FileDiff, tone: 'info', count: filesCount },
      ],
    },
    {
      label: 'Artifacts',
      rows: [
        { kind: 'plans', label: 'Plans', icon: FileText, tone: 'success', count: activePlans },
        { kind: 'scripts', label: 'Scripts', icon: Terminal, tone: 'info', count: runningScripts },
      ],
    },
    {
      label: 'Context',
      rows: contextRows,
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
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              {group.label}
            </span>
            {group.rows.map((row) => {
              const active = activeLens === row.kind;
              return (
                <button
                  key={row.kind}
                  type="button"
                  onClick={() => onSelect(row.kind)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
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
                    className={cn('min-w-0 flex-1 truncate text-[13px]', active && 'font-medium')}
                  >
                    {row.label}
                  </span>
                  {row.count != null && row.count > 0 ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      {row.secondaryDot ? <StatusDot tone="accent" size="sm" /> : null}
                      {row.dot === 'running' ? <StatusDot tone="info" size="sm" pulsing /> : null}
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
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </ScrollFade>
  );
};
