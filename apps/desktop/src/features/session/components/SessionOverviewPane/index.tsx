import { useMemo } from 'react';
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
  MessageSquareReply,
  Pencil,
  SquareTerminal,
  Target,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FolderGit2 } from 'lucide-react';
import { Chip, cn, Divider, Eyebrow, ScrollFade, StatusDot, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { Session, SessionId, SessionStage, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
} from '../../../../store';
import type { FilesTouched, LensKind } from '../../../../store';
import { STAGE_TONE } from '../../session-stage';
import { outcomeTone, type SpawnNodeStatus } from '../../../orchestration/components/SpawnTree/lib';
import type { RunLaneModel } from '../../../orchestration/hooks/useWorkspaceRuns';
import { useWorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
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

type Nudge = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly detail: string;
  readonly lens: LensKind;
};

type Metric = {
  readonly kind: LensKind;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly value: string;
  readonly label: string;
  readonly active: boolean;
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

const isGhostStep = (status: SpawnNodeStatus): boolean =>
  status === 'planned' || status === 'queued';

const PipelineLane = ({
  lane,
  onOpen,
}: {
  readonly lane: RunLaneModel;
  readonly onOpen: () => void;
}) => {
  const done = lane.steps.filter((s) => s.status === 'done').length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-2.5 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-border"
    >
      <Workflow size={13} aria-hidden className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {lane.workflowName}
      </span>
      {lane.autoRun ? <Chip tone="danger" size="sm" label="auto" /> : null}
      <span className="flex shrink-0 items-center gap-1">
        {lane.steps.map((step) => (
          <StatusDot
            key={step.stepId}
            tone={step.status === 'running' ? 'info' : outcomeTone(step.status)}
            size="sm"
            pulsing={step.status === 'running'}
            className={isGhostStep(step.status) ? 'opacity-40' : undefined}
          />
        ))}
      </span>
      <span className="shrink-0 tabular-nums text-2xs text-muted-foreground/60">
        {done}/{lane.steps.length}
      </span>
      <ArrowRight
        size={14}
        aria-hidden
        className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  );
};

const SummaryRow = ({
  icon: Icon,
  tone,
  label,
  onClick,
}: {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-border"
  >
    <Icon size={14} aria-hidden className={cn('shrink-0', tintClasses(tone).icon)} />
    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
    <ArrowRight
      size={14}
      aria-hidden
      className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
    />
  </button>
);

type PipelineSectionProps = {
  readonly session: Session;
  readonly workspaceId: WorkspaceId;
  readonly onSelectLens: (lens: LensKind) => void;
};

const PipelineSection = ({ session, workspaceId, onSelectLens }: PipelineSectionProps) => {
  const sessionList = useMemo(() => [session], [session]);
  const { lanes, freeAgents, resolveQueue } = useWorkspaceRuns(workspaceId, sessionList);

  if (lanes.length === 0 && freeAgents.length === 0 && resolveQueue.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow label="Activity" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-2">
        {lanes.map((lane) => (
          <PipelineLane key={lane.runId} lane={lane} onOpen={() => onSelectLens('workflows')} />
        ))}
        {freeAgents.length > 0 ? (
          <SummaryRow
            icon={Bot}
            tone="primary"
            label={`${freeAgents.length} ${freeAgents.length === 1 ? 'agent' : 'agents'}`}
            onClick={() => onSelectLens('agents')}
          />
        ) : null}
        {resolveQueue.length > 0 ? (
          <SummaryRow
            icon={MessageSquareReply}
            tone="success"
            label={`${resolveQueue.length} in resolve queue`}
            onClick={() => onSelectLens('resolve')}
          />
        ) : null}
      </div>
    </div>
  );
};

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
  const hasPr = useAppStore(
    (s) => s.sessionGithub[session.id]?.pr != null || s.sessionGitlabMr[session.id]?.mr != null,
  );

  const openCount = openQuestions.length;
  const activeWorkflows = session.workflowRuns.filter((r) => r.discardedAt == null).length;
  const isFresh = activeWorkflows === 0 && agents.length === 0;
  const isRunning = runningAgents > 0 || (activeWorkflows > 0 && stage.stage === 'running');

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

  const metrics: Metric[] = [
    {
      kind: 'files',
      icon: FileDiff,
      tone: 'info',
      value: String(filesTouched.count),
      label: filesTouched.count === 1 ? 'file' : 'files',
      active: filesTouched.count > 0,
    },
    {
      kind: 'agents',
      icon: Bot,
      tone: 'primary',
      value: runningAgents > 0 ? `${runningAgents}/${agents.length}` : String(agents.length),
      label: runningAgents > 0 ? 'running' : 'agents',
      active: agents.length > 0,
      alert: attention.active,
    },
    {
      kind: 'plans',
      icon: FileText,
      tone: 'success',
      value: String(activePlans),
      label: activePlans === 1 ? 'plan' : 'plans',
      active: activePlans > 0,
    },
    {
      kind: 'questions',
      icon: CircleHelp,
      tone: 'warning',
      value: String(openCount),
      label: openCount === 1 ? 'question' : 'questions',
      active: openCount > 0,
      alert: openCount > 0,
    },
    {
      kind: 'pr',
      icon: GitPullRequest,
      tone: 'accent',
      value: hasPr ? 'Open' : 'None',
      label: 'pull request',
      active: hasPr,
    },
  ];

  return (
    <ScrollFade className="h-full" viewportClassName="px-8 py-7" fadeSize={24}>
      <div className="animate-fade-in mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <StatusDot tone={STAGE_TONE[stage.stage]} pulsing={stage.stage === 'running'} />
            <Eyebrow label={STAGE_LABEL[stage.stage]} />
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
            <Eyebrow label="Needs you" muted className="px-0.5 font-medium" />
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
        ) : null}

        {isFresh ? (
          <div className="flex flex-col gap-2">
            <Eyebrow label="Get started" muted className="px-0.5 font-medium" />
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
                    tintClasses('accent').bg,
                    tintClasses('accent').ring,
                  )}
                >
                  <Workflow size={16} aria-hidden className={tintClasses('accent').icon} />
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
                    tintClasses('primary').bg,
                    tintClasses('primary').ring,
                  )}
                >
                  <Bot size={16} aria-hidden className={tintClasses('primary').icon} />
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
        ) : workspace ? (
          <PipelineSection
            session={session}
            workspaceId={workspace.id}
            onSelectLens={onSelectLens}
          />
        ) : null}

        {!isFresh && nudges.length === 0 && !isRunning ? (
          <span className="px-0.5 text-2xs text-muted-foreground/70">
            All clear, nothing running.
          </span>
        ) : null}

        {!isFresh ? (
          <div className="flex flex-col gap-2">
            <Eyebrow label="At a glance" muted className="px-0.5 font-medium" />
            <div className="flex flex-wrap items-stretch gap-1.5">
              {metrics.map((metric) => (
                <button
                  key={metric.kind}
                  type="button"
                  onClick={() => onSelectLens(metric.kind)}
                  className={cn(
                    'group inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-left transition-colors',
                    metric.alert
                      ? 'border-warning/40 hover:border-warning/60'
                      : 'border-border-soft hover:border-border hover:bg-foreground/[0.02]',
                    !metric.active && 'opacity-55',
                  )}
                >
                  <metric.icon
                    size={13}
                    aria-hidden
                    className={cn('shrink-0', tintClasses(metric.tone).icon)}
                  />
                  <span className="text-sm font-semibold leading-none text-foreground tabular-nums">
                    {metric.value}
                  </span>
                  <span className="text-2xs text-muted-foreground">{metric.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Divider />

        <div className="flex flex-col gap-2">
          <Eyebrow label="Jump to" muted className="px-0.5 font-medium" />
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_LINKS.map((link) => (
              <button
                key={link.kind}
                type="button"
                onClick={() => onSelectLens(link.kind)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-foreground/[0.03] hover:text-foreground"
              >
                <link.icon size={13} aria-hidden className={tintClasses(link.tone).icon} />
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollFade>
  );
};
