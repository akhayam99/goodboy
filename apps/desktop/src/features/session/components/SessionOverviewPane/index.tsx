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
  Pencil,
  SquareTerminal,
  Target,
  Terminal,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FolderGit2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId, SessionStage } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
} from '../../../../store';
import type { FilesTouched, LensKind } from '../../../../store';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { SummarizerBadge } from '../../../workspace/components/SessionDetailPanel/SummarizerBadge';
import { BranchChip } from './BranchChip';
import { SessionCostChip } from './SessionCostChip';
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
  running: 'bg-info motion-safe:animate-pulse',
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
  const workspace = useCurrentWorkspace();
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId] ?? null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
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
  const isFresh = activeWorkflows === 0 && agents.length === 0;

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', {
        detail: { sessionId: session.id as SessionId },
      }),
    );
  };

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
            <span className="text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
              {STAGE_LABEL[stage.stage]}
            </span>
          </div>
          <div className="group/goal flex items-start gap-2">
            <h1 className="text-balance text-xl font-semibold leading-snug text-foreground">
              {session.goal || 'Untitled session'}
            </h1>
            <button
              type="button"
              onClick={() => onSelectLens('goal')}
              aria-label="edit goal"
              title="Edit goal"
              className={cn(
                'mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50',
                'opacity-0 transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                'group-hover/goal:opacity-100 motion-reduce:opacity-60',
              )}
            >
              <Pencil size={13} aria-hidden />
            </button>
          </div>
          {stage.reason ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{stage.reason}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {workspace ? (
              <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-md border border-border-soft bg-muted/30 px-2 py-1 text-2xs text-foreground/80">
                <FolderGit2 size={10} aria-hidden className="shrink-0 text-muted-foreground" />
                <span className="truncate">{workspace.name}</span>
              </span>
            ) : null}
            {branch ? <BranchChip branch={branch} /> : null}
            <SessionCostChip sessionId={session.id as SessionId} />
            <SummarizerBadge sessionId={session.id as SessionId} />
            <span className="text-2xs text-muted-foreground/70">
              {formatRelativeDuration(session.createdAt)} ago
            </span>
          </div>
        </div>

        {nudges.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="px-0.5 text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground/60">
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
                    className="shrink-0 text-muted-foreground/40 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3 py-2.5 text-sm text-muted-foreground shadow-sm">
            <ListChecks size={15} aria-hidden className="shrink-0 text-success" />
            <span>Nothing needs you. Pick a lens to dig in.</span>
          </div>
        )}

        {isFresh ? (
          <div className="flex flex-col gap-2">
            <span className="px-0.5 text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground/60">
              Get started
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openWorkflowBuilder}
                className="group flex items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3.5 py-3 text-left shadow-sm transition-colors hover:border-border"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
                    TONE.accent.chip,
                  )}
                >
                  <Workflow size={16} aria-hidden className={TONE.accent.icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    Create a workflow
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Chain agents into steps
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  void spawnAgent(session.id as SessionId, {});
                }}
                className="group flex items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3.5 py-3 text-left shadow-sm transition-colors hover:border-border"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
                    TONE.primary.chip,
                  )}
                >
                  <Bot size={16} aria-hidden className={TONE.primary.icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    Spawn an agent
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Start a one-off session
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="px-0.5 text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground/60">
              At a glance
            </span>
            <div className="grid grid-cols-2 gap-2">
              {stats.map((stat) => (
                <button
                  key={stat.kind}
                  type="button"
                  onClick={() => onSelectLens(stat.kind)}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border bg-elevated px-3.5 py-3 text-left shadow-sm transition-colors',
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
                    className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="px-0.5 text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground/60">
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
