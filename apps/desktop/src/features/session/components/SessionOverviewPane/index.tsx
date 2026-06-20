import {
  Activity,
  ArrowRight,
  Bot,
  CheckCheck,
  CircleHelp,
  FileDiff,
  FileText,
  GitPullRequest,
  Layers,
  ListChecks,
  SquareTerminal,
  Target,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionStage } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
} from '../../../../store';
import type { FilesTouched, LensKind } from '../../../../store';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import {
  resolveAttentionLens,
  selectAttention,
  selectOpenQuestions,
  selectStandaloneAgents,
} from './lib';

type SessionOverviewPaneProps = {
  readonly session: Session;
  readonly filesTouched: FilesTouched;
  readonly onSelectLens: (lens: LensKind) => void;
};

const STAGE_LABEL: Record<SessionStage, string> = {
  attention: 'Needs attention',
  running: 'Running',
  review: 'In review',
  building: 'Building',
  done: 'Done',
};

const STAGE_DOT: Record<SessionStage, string> = {
  attention: 'bg-warning',
  running: 'bg-info animate-pulse',
  review: 'bg-primary',
  building: 'bg-muted-foreground',
  done: 'bg-success',
};

type Tone = 'primary' | 'success' | 'info' | 'warning' | 'accent' | 'neutral';

const TONE: Record<Tone, { readonly icon: string; readonly chip: string }> = {
  primary: { icon: 'text-primary', chip: 'bg-primary/10 ring-primary/20' },
  success: { icon: 'text-success', chip: 'bg-success/10 ring-success/20' },
  info: { icon: 'text-info', chip: 'bg-info/10 ring-info/20' },
  warning: { icon: 'text-warning', chip: 'bg-warning/10 ring-warning/20' },
  accent: { icon: 'text-accent', chip: 'bg-accent/10 ring-accent/20' },
  neutral: { icon: 'text-muted-foreground', chip: 'bg-muted ring-border-soft' },
};

type Nudge = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly detail: string;
  readonly lens: LensKind;
};

type Stat = {
  readonly kind: LensKind;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly value: string;
  readonly label: string;
  readonly alert?: boolean;
};

const CONTEXT_LINKS: ReadonlyArray<{
  readonly kind: LensKind;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
}> = [
  { kind: 'goal', icon: Target, tone: 'primary', label: 'Goal' },
  { kind: 'decisions', icon: CheckCheck, tone: 'success', label: 'Decisions' },
  { kind: 'last_output_summary', icon: Activity, tone: 'info', label: 'Last output' },
  { kind: 'terminal', icon: SquareTerminal, tone: 'neutral', label: 'Terminal' },
];

export const SessionOverviewPane = ({
  session,
  filesTouched,
  onSelectLens,
}: SessionOverviewPaneProps) => {
  const stage = useSessionStageInfo(session);
  const attention = selectAttention(stage);
  const openQuestions = selectOpenQuestions(useSessionOpenQuestions(session.id));
  const agents = selectStandaloneAgents(
    useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY),
  );
  const runningAgents = agents.filter((a) => a.status === 'running').length;
  const activePlans = useSessionPlans(session.id).filter((p) => p.status === 'active').length;
  const runningScripts = useAppStore((s) => {
    const runs = s.scriptRuns[session.id];
    if (!runs) {
      return 0;
    }
    return Object.values(runs).filter((r) => r.status === 'pending').length;
  });
  const hasPr = useAppStore(
    (s) => s.sessionGithub[session.id]?.pr != null || s.sessionGitlabMr[session.id]?.mr != null,
  );

  const openCount = openQuestions.length;
  const activeWorkflows = session.workflowRuns.filter((r) => r.discardedAt == null).length;

  const nudges: Nudge[] = [];
  if (openCount > 0) {
    nudges.push({
      icon: CircleHelp,
      label: `${openCount} open ${openCount === 1 ? 'question' : 'questions'}`,
      detail: openQuestions[0]!.text.trim().split('\n')[0] ?? '',
      lens: 'questions',
    });
  }
  const attentionLens = resolveAttentionLens(stage, {
    hasStandalone: agents.length > 0,
    hasWorkflow: activeWorkflows > 0,
  });
  if (attention.active && attentionLens && attentionLens !== 'questions') {
    nudges.push({
      icon: attentionLens === 'pr' ? GitPullRequest : attentionLens === 'workflows' ? Layers : Bot,
      label:
        attentionLens === 'pr'
          ? 'Your pull request needs you'
          : attentionLens === 'workflows'
            ? 'A workflow needs you'
            : 'An agent needs you',
      detail: attention.reason,
      lens: attentionLens,
    });
  }

  const stats: Stat[] = [
    {
      kind: 'workflows',
      icon: Layers,
      tone: 'accent',
      value: String(activeWorkflows),
      label: 'active workflows',
    },
    {
      kind: 'agents',
      icon: Bot,
      tone: 'primary',
      value:
        agents.length === 0
          ? 'None'
          : runningAgents > 0
            ? `${runningAgents}/${agents.length}`
            : String(agents.length),
      label: runningAgents > 0 ? 'agents running' : 'agents',
      alert: attention.active,
    },
    {
      kind: 'files',
      icon: FileDiff,
      tone: 'info',
      value: String(filesTouched.count),
      label: filesTouched.count === 1 ? 'file changed' : 'files changed',
    },
    {
      kind: 'plans',
      icon: FileText,
      tone: 'success',
      value: String(activePlans),
      label: 'active plans',
    },
    {
      kind: 'scripts',
      icon: Terminal,
      tone: 'info',
      value: runningScripts > 0 ? String(runningScripts) : '0',
      label: runningScripts > 0 ? 'scripts running' : 'scripts',
    },
    {
      kind: 'pr',
      icon: GitPullRequest,
      tone: 'accent',
      value: hasPr ? 'Open' : '—',
      label: 'pull request',
    },
    {
      kind: 'questions',
      icon: CircleHelp,
      tone: 'warning',
      value: String(openCount),
      label: 'open questions',
      alert: openCount > 0,
    },
  ];

  return (
    <ScrollFade className="h-full px-8 py-7">
      <div className="animate-fade-in mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn('size-2 shrink-0 rounded-full', STAGE_DOT[stage.stage])}
            />
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {STAGE_LABEL[stage.stage]}
            </span>
          </div>
          <h1 className="text-balance text-xl font-semibold leading-snug text-foreground">
            {session.goal || 'Untitled session'}
          </h1>
          {stage.reason ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{stage.reason}</p>
          ) : null}
        </div>

        {nudges.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="px-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              Needs you
            </span>
            <div className="flex flex-col gap-1.5">
              {nudges.map((nudge) => (
                <button
                  key={nudge.lens}
                  type="button"
                  onClick={() => onSelectLens(nudge.lens)}
                  className="group flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/[0.04] px-3 py-2.5 text-left shadow-sm transition-colors hover:border-warning/50 hover:bg-warning/[0.08]"
                >
                  <nudge.icon size={15} aria-hidden className="shrink-0 text-warning" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {nudge.label}
                    </span>
                    {nudge.detail ? (
                      <span className="truncate text-2xs text-muted-foreground">
                        {nudge.detail}
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3 py-2.5 text-sm text-muted-foreground shadow-sm">
            <ListChecks size={15} aria-hidden className="shrink-0 text-success" />
            <span>Nothing needs you right now. Pick a lens to dig in.</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="px-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
            At a glance
          </span>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <button
                key={stat.kind}
                type="button"
                onClick={() => onSelectLens(stat.kind)}
                className={cn(
                  'group flex items-center gap-3 rounded-xl border bg-elevated px-3.5 py-3 text-left shadow-sm transition-all',
                  'hover:-translate-y-px hover:shadow-md',
                  stat.alert
                    ? 'border-warning/40 hover:border-warning/60'
                    : 'border-border-soft hover:border-border',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
                    TONE[stat.tone].chip,
                  )}
                >
                  <stat.icon size={16} aria-hidden className={TONE[stat.tone].icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-lg font-semibold leading-none text-foreground tabular-nums">
                    {stat.value}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{stat.label}</span>
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="px-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
            Jump to
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_LINKS.map((link) => (
              <button
                key={link.kind}
                type="button"
                onClick={() => onSelectLens(link.kind)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-foreground/[0.03] hover:text-foreground"
              >
                <link.icon size={13} aria-hidden className={TONE[link.tone].icon} />
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollFade>
  );
};
