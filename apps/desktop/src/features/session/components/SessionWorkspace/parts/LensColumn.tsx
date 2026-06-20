import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  CheckCheck,
  CircleHelp,
  FileDiff,
  FileText,
  GitPullRequest,
  LayoutDashboard,
  Layers,
  MessageSquareReply,
  SquareTerminal,
  Target,
  Terminal,
} from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, Session, SessionId } from '@goodboy/types';
import { type AgentKind, inferAgentKindFromName } from '../../../../session/agent-kind';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
} from '../../../../../store';
import type { LensKind } from '../../../../../store';
import {
  isStandaloneAgent,
  resolveAttentionLens,
  selectOpenQuestions,
} from '../../SessionOverviewPane/lib';

const isResolverAgent = (agent: Agent, override: AgentKind | null): boolean =>
  isStandaloneAgent(agent) && (override ?? inferAgentKindFromName(agent.name)) === 'resolver';

type LensColumnProps = {
  readonly session: Session;
  readonly activeLens: LensKind | null;
  readonly onSelect: (lens: LensKind) => void;
  readonly onSelectOverview: () => void;
  readonly filesCount: number;
};

type LensTone = 'primary' | 'success' | 'info' | 'warning' | 'accent' | 'neutral';

const TONE: Record<LensTone, { readonly icon: string; readonly chip: string }> = {
  primary: { icon: 'text-primary', chip: 'bg-primary/10 ring-primary/20' },
  success: { icon: 'text-success', chip: 'bg-success/10 ring-success/20' },
  info: { icon: 'text-info', chip: 'bg-info/10 ring-info/20' },
  warning: { icon: 'text-warning', chip: 'bg-warning/10 ring-warning/20' },
  accent: { icon: 'text-accent', chip: 'bg-accent/10 ring-accent/20' },
  neutral: { icon: 'text-muted-foreground', chip: 'bg-muted ring-border-soft' },
};

type LensRow = {
  readonly kind: LensKind;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tone: LensTone;
  readonly count?: number;
  readonly dot?: 'attention' | 'running';
};

type LensGroup = {
  readonly label: string;
  readonly rows: ReadonlyArray<LensRow>;
};

export const LensColumn = ({
  session,
  activeLens,
  onSelect,
  onSelectOverview,
  filesCount,
}: LensColumnProps) => {
  const sessionId = session.id as SessionId;
  const openCount = selectOpenQuestions(useSessionOpenQuestions(sessionId)).length;
  const hasStandaloneAgent = useAppStore((s) =>
    (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).some(isStandaloneAgent),
  );
  const hasRunningAgent = useAppStore((s) =>
    (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).some(
      (a) => a.status === 'running' && isStandaloneAgent(a),
    ),
  );
  const activeWorkflows = session.workflowRuns.filter((r) => r.discardedAt == null).length;
  const attentionLens = resolveAttentionLens(useSessionStageInfo(session), {
    hasStandalone: hasStandaloneAgent,
    hasWorkflow: activeWorkflows > 0,
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
  const openResolvers = useAppStore((s) => {
    const runs = s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY;
    return runs.reduce(
      (n, r) =>
        n +
        (isResolverAgent(r, s.agentKindOverride[r.id] ?? null) &&
        (r.status === 'pending' || r.status === 'running')
          ? 1
          : 0),
      0,
    );
  });

  const contextRows: ReadonlyArray<LensRow> = [
    { kind: 'goal', label: 'Goal', icon: Target, tone: 'primary' },
    { kind: 'decisions', label: 'Decisions', icon: CheckCheck, tone: 'success' },
    { kind: 'last_output_summary', label: 'Last output', icon: Activity, tone: 'info' },
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
          dot: attentionLens === 'workflows' ? 'attention' : undefined,
        },
        {
          kind: 'agents',
          label: 'Agents',
          icon: Bot,
          tone: 'primary',
          dot: attentionLens === 'agents' ? 'attention' : hasRunningAgent ? 'running' : undefined,
        },
        {
          kind: 'resolve',
          label: 'Resolve',
          icon: MessageSquareReply,
          tone: 'success',
          count: openResolvers,
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

  const overviewActive = activeLens === null;

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
      <button
        type="button"
        onClick={onSelectOverview}
        aria-current={overviewActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
          overviewActive
            ? 'bg-foreground/[0.06] text-foreground'
            : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-md ring-1',
            TONE.neutral.chip,
          )}
        >
          <LayoutDashboard size={12} aria-hidden className={TONE.neutral.icon} />
        </span>
        <span
          className={cn('min-w-0 flex-1 truncate text-[13px]', overviewActive && 'font-medium')}
        >
          Overview
        </span>
      </button>
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
                  active
                    ? 'bg-foreground/[0.06] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors',
                    TONE[row.tone].chip,
                  )}
                >
                  <row.icon size={12} aria-hidden className={TONE[row.tone].icon} />
                </span>
                <span
                  className={cn('min-w-0 flex-1 truncate text-[13px]', active && 'font-medium')}
                >
                  {row.label}
                </span>
                {row.count != null && row.count > 0 ? (
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium tabular-nums',
                      row.dot === 'attention'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {row.count}
                  </span>
                ) : row.dot ? (
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      row.dot === 'attention' ? 'bg-warning' : 'animate-pulse bg-info',
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
};
