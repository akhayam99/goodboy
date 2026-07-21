import { useEffect } from 'react';
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
  Terminal,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FolderGit2 } from 'lucide-react';
import { cn, Divider, Eyebrow, Input, ScrollFade, StatusDot, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId, SessionStage } from '@goodboy/types';
import {
  agentHasUnread,
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionStageInfo,
  useSessionUnreadLens,
} from '../../../../store';
import type { FilesTouched, LensKind } from '../../../../store';
import { STAGE_TONE } from '../../session-stage';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { SummarizerBadge } from '../../../workspace/components/SessionDetailPanel/SummarizerBadge';
import { BranchChip } from './BranchChip';
import { SessionCostChip } from './SessionCostChip';
import { classifyAgent, selectStandaloneAgents } from '../../agent-kind';
import { resolveAttentionLens, selectAttention, selectOpenQuestions } from './lib';
import { SpawnAgentMenu } from '../../../workspace/components/WorkspacesSidebar/parts/SpawnAgentMenu';
import { PendingResolutionsStrip } from '../../../context/components/ContextPanel/strips/PendingResolutionsStrip';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { useResolvableCount } from '../../hooks/useResolvableCount';
import { pullRequestMeta } from '../../../github/components/PullRequestChip';
import { PipelineSection } from './PipelineSection';
import { StartRowContent } from './StartRowContent';
import { StartTileContent } from './StartTileContent';
import { SummaryRow } from './SummaryRow';

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
  readonly itemId?: string;
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

const PRIMARY_CONTEXT_LINKS: ReadonlyArray<{
  readonly kind: LensKind;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
}> = [
  { kind: 'goal', icon: Target, tone: 'primary', label: 'Goal' },
  { kind: 'decisions', icon: CheckCheck, tone: 'success', label: 'Decisions' },
  { kind: 'last_output_summary', icon: Activity, tone: 'info', label: 'Session TLDR' },
];

const SECONDARY_CONTEXT_LINKS: ReadonlyArray<{
  readonly kind: LensKind;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
}> = [
  { kind: 'scripts', icon: Terminal, tone: 'info', label: 'Scripts' },
  { kind: 'terminal', icon: SquareTerminal, tone: 'neutral', label: 'Terminal' },
];

const startRowClass = (primary?: boolean): string =>
  cn(
    'group flex w-full items-center gap-3 rounded-lg border bg-elevated px-3.5 py-3 text-left shadow-sm transition-colors',
    primary
      ? 'border-accent/40 ring-1 ring-accent/30 hover:border-accent/60'
      : 'border-border-soft hover:border-border',
  );

const startTileClass = (primary?: boolean): string =>
  cn(
    'group flex items-center gap-2.5 rounded-lg border bg-elevated px-3 py-2.5 text-left shadow-sm transition-colors',
    primary
      ? 'border-accent/40 ring-1 ring-accent/30 hover:border-accent/60'
      : 'border-border-soft hover:border-border',
  );

export const SessionOverviewPane = ({
  session,
  filesTouched,
  onSelectLens,
}: SessionOverviewPaneProps) => {
  const stage = useSessionStageInfo(session);
  const rename = useSessionTitleRename({
    sessionId: session.id as SessionId,
    currentTitle: session.goal,
  });
  const workspace = useCurrentWorkspace();
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId] ?? null);
  const attention = selectAttention(stage);
  const openQuestions = selectOpenQuestions(useSessionOpenQuestions(session.id));
  const rawStandalone = selectStandaloneAgents(
    useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY),
  );
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const hasResolver = rawStandalone.some(
    (agent) => classifyAgent(agent, agentKindOverride[agent.id] ?? null) === 'resolver',
  );
  const nonResolverAgents = useNonResolverStandaloneAgents(session.id as SessionId);
  const unreadLens = useSessionUnreadLens(session.id as SessionId);
  const runningAgents = nonResolverAgents.filter((a) => a.status === 'running').length;
  const activePlans = useSessionPlans(session.id).filter((p) => p.status === 'active').length;
  const pullRequestState = useAppStore((s) => s.sessionGithub[session.id]?.pr?.state ?? null);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[session.id]?.mr ?? null);
  const mergeRequestState =
    mergeRequest == null
      ? null
      : mergeRequest.draft
        ? 'draft'
        : mergeRequest.state === 'merged'
          ? 'merged'
          : mergeRequest.state === 'closed'
            ? 'closed'
            : 'open';
  const pullRequestLabel =
    pullRequestState != null
      ? pullRequestMeta(pullRequestState).label
      : mergeRequestState != null
        ? pullRequestMeta(mergeRequestState).label
        : 'None';
  const hasPr = pullRequestState != null || mergeRequest != null;
  const resolvable = useResolvableCount(session.id as SessionId);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const loadPendingResolutions = useAppStore((s) => s.loadPendingResolutions);

  useEffect(() => {
    void loadPendingResolutions(session.id as SessionId);
  }, [session.id, loadPendingResolutions]);

  const openCount = openQuestions.length;
  const resolvableItems = resolvable.prComments + resolvable.diffComments + resolvable.pending;
  const commentsToResolve = resolvable.prComments + resolvable.diffComments;
  const activeWorkflows = session.workflowRuns.filter((r) => r.discardedAt == null).length;
  const isFresh = activeWorkflows === 0 && rawStandalone.length === 0;
  const isRunning = runningAgents > 0 || (activeWorkflows > 0 && stage.stage === 'running');
  const attentionLens = resolveAttentionLens(stage, {
    hasNonResolverStandalone: nonResolverAgents.length > 0,
    hasWorkflow: activeWorkflows > 0,
    hasResolver,
    unreadLens,
  });

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', {
        detail: { sessionId: session.id as SessionId },
      }),
    );
  };

  const pickAgentId = (candidates: ReadonlyArray<Agent>): string | undefined => {
    if (candidates.length === 0) {
      return undefined;
    }
    const needsAttention =
      candidates.find((a) => agentHasUnread(a, false)) ??
      candidates.find((a) => a.status === 'failed') ??
      candidates.find((a) => a.status === 'running');
    return (needsAttention ?? candidates[0])!.id;
  };

  const attentionItemId = (lens: LensKind): string | undefined => {
    if (lens === 'agents') {
      return pickAgentId(nonResolverAgents);
    }
    if (lens === 'resolve') {
      return pickAgentId(
        rawStandalone.filter(
          (agent) => classifyAgent(agent, agentKindOverride[agent.id] ?? null) === 'resolver',
        ),
      );
    }
    if (lens === 'workflows') {
      const runs = session.workflowRuns.filter((r) => r.discardedAt == null);
      const withQuestions = runs.find((r) => workflowRunHasOpenQuestions(openQuestions, r.id));
      return (withQuestions ?? runs[runs.length - 1])?.id;
    }
    return undefined;
  };

  const openNudge = (nudge: Nudge) => {
    if (nudge.itemId && nudge.lens === 'workflows') {
      setFocusedWorkflowRun(session.id as SessionId, nudge.itemId);
      onSelectLens('workflows');
      return;
    }
    if (nudge.itemId && (nudge.lens === 'agents' || nudge.lens === 'resolve')) {
      onSelectLens(nudge.lens);
      void selectAgent(session.id as SessionId, nudge.itemId as AgentId);
      return;
    }
    onSelectLens(nudge.lens);
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
  if (attention.active && attentionLens && attentionLens !== 'questions') {
    const attentionIcon =
      attentionLens === 'pr'
        ? GitPullRequest
        : attentionLens === 'workflows'
          ? Layers
          : attentionLens === 'resolve'
            ? MessageSquareReply
            : Bot;
    const attentionLabel =
      attentionLens === 'pr'
        ? 'Your pull request needs you'
        : attentionLens === 'workflows'
          ? 'A workflow needs you'
          : attentionLens === 'resolve'
            ? 'A resolver needs you'
            : 'An agent needs you';
    nudges.push({
      icon: attentionIcon,
      label: attentionLabel,
      detail: attention.reason,
      lens: attentionLens,
      itemId: attentionItemId(attentionLens),
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
      value:
        runningAgents > 0
          ? `${runningAgents}/${nonResolverAgents.length}`
          : String(nonResolverAgents.length),
      label: runningAgents > 0 ? 'running' : 'agents',
      active: nonResolverAgents.length > 0,
      alert: attention.active && attentionLens === 'agents',
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
      value: pullRequestLabel,
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
          {rename.renaming ? (
            <div className="flex flex-col gap-1">
              <Input
                autoFocus
                value={rename.draft}
                maxLength={rename.maxLength}
                onChange={(e) => rename.setDraft(e.target.value)}
                onBlur={() => void rename.commit()}
                onKeyDown={rename.onKeyDown}
                aria-label="session goal"
                className="text-xl font-semibold"
              />
              {rename.error && <span className="text-2xs text-danger">{rename.error}</span>}
            </div>
          ) : (
            <div className="group/goal flex items-start gap-2">
              <h1 className="text-balance text-xl font-semibold leading-snug text-foreground">
                {session.goal || 'Untitled session'}
              </h1>
              <button
                type="button"
                onClick={rename.start}
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
          )}
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

        <div className="grid grid-cols-3 gap-2">
          {PRIMARY_CONTEXT_LINKS.map((link) => (
            <SummaryRow
              key={link.kind}
              icon={link.icon}
              tone={link.tone}
              label={link.label}
              onClick={() => onSelectLens(link.kind)}
            />
          ))}
        </div>

        {isFresh ? (
          <div className="flex flex-col gap-2">
            <Eyebrow label="Start" muted className="px-0.5 font-medium" />
            <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-elevated px-4 py-3.5">
              <div className="flex flex-col gap-1">
                <Eyebrow label="New session" className="text-muted-foreground/70" />
                <p className="text-base font-semibold text-foreground">Choose how to start</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Two ways to begin. Workflows are the recommended starting point for most tasks.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={openWorkflowBuilder} className={startRowClass(true)}>
                  <StartRowContent
                    icon={Workflow}
                    tone="accent"
                    label="Workflow"
                    description="Runs a multi-step pipeline: scout, plan, implement, test, review."
                    chip
                  />
                </button>
                <SpawnAgentMenu
                  sessionId={session.id as SessionId}
                  trigger={({ ref, onClick, ...aria }) => (
                    <button
                      ref={ref}
                      type="button"
                      onClick={onClick}
                      className={startRowClass()}
                      {...aria}
                    >
                      <StartRowContent
                        icon={Bot}
                        tone="primary"
                        label="Agent"
                        description="A single specialist for a one-off task."
                      />
                    </button>
                  )}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Eyebrow label="Start" muted className="px-0.5 font-medium" />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={openWorkflowBuilder} className={startTileClass()}>
                <StartTileContent icon={Workflow} tone="accent" label="New workflow" />
              </button>
              <SpawnAgentMenu
                sessionId={session.id as SessionId}
                trigger={({ ref, onClick, ...aria }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={onClick}
                    className={startTileClass()}
                    {...aria}
                  >
                    <StartTileContent icon={Bot} tone="primary" label="Create agent" />
                  </button>
                )}
              />
            </div>
          </div>
        )}

        {nudges.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Eyebrow label="Needs you" muted className="px-0.5 font-medium" />
            <div className="flex flex-col gap-1.5">
              {nudges.map((nudge) => (
                <button
                  key={nudge.itemId ?? nudge.lens}
                  type="button"
                  onClick={() => openNudge(nudge)}
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

        {workspace ? (
          <PipelineSection
            session={session}
            workspaceId={workspace.id}
            onSelectLens={onSelectLens}
          />
        ) : null}

        {resolvableItems > 0 ? (
          <div className="flex flex-col gap-2">
            <Eyebrow label="Resolve" muted className="px-0.5 font-medium" />
            <div className="flex flex-col gap-2">
              {resolvable.pending > 0 ? (
                <PendingResolutionsStrip sessionId={session.id as SessionId} />
              ) : null}
              {commentsToResolve > 0 ? (
                <SummaryRow
                  icon={MessageSquareReply}
                  tone="success"
                  label={`${commentsToResolve} comment${commentsToResolve === 1 ? '' : 's'} to resolve`}
                  onClick={() => onSelectLens('resolve')}
                />
              ) : null}
            </div>
          </div>
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
            {SECONDARY_CONTEXT_LINKS.map((link) => (
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
