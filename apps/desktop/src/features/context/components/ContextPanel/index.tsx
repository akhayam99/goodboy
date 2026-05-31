import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  PanelRightClose,
  PanelRightOpen,
  History,
  RotateCcw,
  RotateCw,
  ChevronRight,
  ChevronDown,
  Clock,
  FileEdit,
  GitPullRequest,
  GitPullRequestArrow,
  Loader2,
  MessageSquare,
  RefreshCw,
  Target,
  CheckCheck,
  HelpCircle,
  Activity,
  ClipboardList,
  BookOpen,
  SquareTerminal,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Divider, ScrollArea, Textarea, Dialog, Markdown, cn } from '@goodboy/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey } from '@goodboy/core';
import type {
  AgentId,
  ContextSlot,
  ContextSlotHistoryEntry,
  PlanId,
  PlanStatus,
  PlanWithCount,
  PrCheckRun,
  Session,
  SessionId,
  TelemetryRecord,
  WorktreeStatus,
} from '@goodboy/types';
import { QuestionsTab } from '../QuestionsTab';
import { useOpenQuestions } from '../QuestionsTab/useOpenQuestions';
import { PlansModal } from '../../../../features/plans/components/PlansModal';
import { PullRequestChip } from '../../../../features/github/components/PullRequestChip';
import { DiffViewerDialog } from '../../../../features/permissions/components/DiffViewerDialog';
import { worktreeStatus } from '../../../../features/worktree/worktree';
import { TerminalPanel } from '../../../../features/scripts/components/TerminalPanel';
import {
  EMPTY_ARRAY,
  useAppStore,
  useDiffComments,
  useFilesTouched,
  useSessionLoading,
  useSessionPlans,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../../../../store';

// TODO (@ak): split file
interface ContextPanelProps {
  session: Session;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  // Keep-alive aware: false when this panel is mounted but hidden behind
  // another session. Effects that touch DB or network gate on this so
  // background panels don't churn.
  isActive?: boolean;
}

type SummarizerStatusKind = 'idle' | 'running' | 'error';

const ICON_BTN =
  'rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

type PanelTab = 'context' | 'plans' | 'questions' | 'terminal';

export function ContextPanel({
  session,
  collapsed = false,
  onCollapse,
  onExpand,
  isActive = true,
}: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const loading = useSessionLoading(session.id);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const sessionTelemetry = useAppStore(
    (s) => s.sessionTelemetry[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const plans = useSessionPlans(session.id);
  const [tab, setTab] = useState<PanelTab>('context');
  const sendTurn = useAppStore((s) => s.sendTurn);
  const { questions, loadQuestions } = useOpenQuestions();

  useEffect(() => {
    if (!isActive) return;
    void loadQuestions(session.id);
  }, [isActive, session.id, loadQuestions]);

  // Route each cluster's batched answer to the cluster's owner agent.
  // When targetAgentId is null (orphan cluster) we fall through to
  // sendTurn's default behaviour: it picks the currently-selected agent
  // for the session, matching the pre-clustering UX.
  const onSubmitAnswers = useCallback(
    async (content: string, targetAgentId: AgentId | null) => {
      await sendTurn({
        sessionId: session.id,
        content,
        agentId: targetAgentId ?? undefined,
      });
    },
    [sendTurn, session.id],
  );

  // Files + GitHub data lifted to the panel so the tab badges stay live
  // regardless of the active tab, and the PR / diff-comment fetches fire
  // even before the user visits those tabs, matching the behaviour of the
  // old SessionMetaFooter, which always rendered for the current session.
  const filesTouched = useFilesTouched(session.id, isActive);
  const github = useAppStore((s) => s.sessionGithub[session.id as SessionId]);
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId] ?? null);
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);

  useEffect(() => {
    if (!isActive) return;
    void loadDiffComments(session.id);
  }, [isActive, session.id, loadDiffComments]);

  const summarizerTotals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let count = 0;
    for (const rec of sessionTelemetry) {
      if (rec.kind !== 'summarizer') continue;
      inputTokens += rec.inputTokens;
      outputTokens += rec.outputTokens;
      estimatedCostUsd += rec.estimatedCostUsd;
      count += 1;
    }
    return { inputTokens, outputTokens, estimatedCostUsd, count };
  }, [sessionTelemetry]);

  const workingDir = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);

  // Self-heal the branch cache: an agent can `git switch` directly in the
  // worktree, moving HEAD without going through changeSessionBranch, which
  // leaves the sidebar footer chip on a stale branch. Read the real branch off
  // worktree_status and write it back. Re-runs after each turn (summarizer
  // tick) and on file-count changes, the moments a branch switch is likely.
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  useEffect(() => {
    if (!isActive || !workingDir) return;
    let cancelled = false;
    worktreeStatus(workingDir)
      .then((status) => {
        if (!cancelled && status.branch) {
          void reconcileSessionBranch(session.id as SessionId, status.branch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    isActive,
    workingDir,
    session.id,
    filesTouched.count,
    summarizer.lastUpdate,
    reconcileSessionBranch,
  ]);

  const slotsByKey = useMemo(
    () =>
      new Map<string, ContextSlot>(
        slots.map((s) => [
          s.key,
          s.key === 'files_touched' ? normalizeFilesSlot(s, workingDir) : s,
        ]),
      ),
    [slots, workingDir],
  );

  // open_questions is pinned in a sticky footer (visible across both tabs);
  // goal/decisions/last_output_summary live in the Context tab.
  const visibleSlotKeys = useMemo(
    () =>
      SLOT_KEYS.filter((k) => k !== 'files_touched' && k !== 'open_questions').sort((a, b) => {
        const order: Record<string, number> = {
          goal: 0,
          decisions: 1,
          last_output_summary: 2,
        };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }),
    [],
  );

  // Count badges on the tab strip, at-a-glance counts beat hunting through.
  const plansBadge = plans.length > 0 ? plans.length : null;
  const hasActivePlan = plans.some((p) => p.status === 'active');
  const questionsBadge = questions.length > 0 ? questions.length : null;
  const isTerminalOpen = useAppStore((s) => s.terminalSessions[session.id as SessionId] === 'open');

  return (
    <>
      <div className={cn('flex h-full w-full justify-end pr-4 pt-4', !collapsed && 'hidden')}>
        <button
          type="button"
          onClick={onExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand?.();
            }
          }}
          title="expand context panel"
          aria-label="expand context panel"
          className={cn(
            'h-fit',
            ICON_BTN,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          )}
        >
          <PanelRightOpen size={13} aria-hidden />
        </button>
      </div>

      <div
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-[6px]',
          collapsed && 'hidden',
        )}
      >
        <div className="shrink-0 flex flex-col gap-0 px-3 pt-3 pb-0">
          <header className="flex items-center justify-between gap-1 px-1 pb-2">
            <TabStrip
              tab={tab}
              onPick={setTab}
              plansBadge={plansBadge}
              plansWarning={hasActivePlan}
              summarizerRunning={summarizer.status === 'running'}
              questionsBadge={questionsBadge}
              isTerminalOpen={isTerminalOpen}
            />
            <div className="flex shrink-0 items-center gap-1">
              <SummarizerBadge
                sessionId={session.id}
                status={summarizer.status}
                lastUpdate={summarizer.lastUpdate}
                error={summarizer.error}
                totals={summarizerTotals}
                canRetry={summarizer.lastAttempt !== null}
              />
              {onCollapse ? (
                <button
                  type="button"
                  onClick={onCollapse}
                  title="hide context panel"
                  aria-label="hide context panel"
                  className={ICON_BTN}
                >
                  <PanelRightClose size={13} aria-hidden />
                </button>
              ) : null}
            </div>
          </header>
        </div>

        {/* Tab content, Context / Plans / Questions / Files / GitHub / Terminal. Open
            Questions is pinned across every tab via the sticky footer below.
            Terminal is always mounted (visibility toggled) so output is not
            lost when the user switches away mid-run. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'absolute inset-0 flex flex-col',
              tab !== 'terminal' && 'invisible pointer-events-none',
            )}
          >
            <TerminalPanel sessionId={session.id} isActive={tab === 'terminal'} cwd={workingDir} />
          </div>
          {tab !== 'terminal' ? (
            <div
              key={tab}
              className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 motion-safe:animate-fade-in"
            >
              {tab === 'context' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                  <ul
                    className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {visibleSlotKeys.map((key) => {
                      const slot = slotsByKey.get(key);
                      return (
                        <SlotRow
                          key={key}
                          sessionId={session.id}
                          slotKey={key}
                          slot={slot}
                          loading={loading.slots}
                          isSummarizing={summarizer.status === 'running'}
                          onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
                        />
                      );
                    })}
                  </ul>
                  <ChangesStrip
                    sessionId={session.id}
                    workingDir={workingDir}
                    filesTouched={filesTouched}
                  />
                </div>
              ) : tab === 'plans' ? (
                <PlansTabContent sessionId={session.id} />
              ) : (
                <QuestionsTab sessionId={session.id} onSubmit={onSubmitAnswers} />
              )}
            </div>
          ) : null}
        </div>

        <Divider />

        {/* Sticky footer. Open questions are owned by the Questions tab now,
            the footer is just a one-click entry point when any are unresolved. */}
        {questions.length > 0 ? (
          <>
            <Divider />
            <button
              type="button"
              onClick={() => setTab('questions')}
              className="flex shrink-0 items-center justify-between gap-2 bg-warning/5 px-4 py-2.5 text-xs text-warning transition-colors hover:bg-warning/10"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle size={12} aria-hidden />
                <span className="font-medium">
                  {questions.length} open question{questions.length !== 1 ? 's' : ''}
                </span>
              </span>
              <ChevronRight size={12} aria-hidden className="shrink-0 opacity-60" />
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}

// TODO (@ak): split file
interface TabStripProps {
  readonly tab: PanelTab;
  readonly onPick: (next: PanelTab) => void;
  readonly plansBadge: number | null;
  readonly plansWarning: boolean;
  readonly summarizerRunning: boolean;
  readonly questionsBadge: number | null;
  readonly isTerminalOpen: boolean;
}

function TabStrip({
  tab,
  onPick,
  plansBadge,
  plansWarning,
  summarizerRunning,
  questionsBadge,
  isTerminalOpen,
}: TabStripProps) {
  return (
    <div role="tablist" aria-label="context panel tabs" className="flex items-center gap-0.5">
      <TabButton
        active={tab === 'context'}
        onClick={() => onPick('context')}
        icon={<BookOpen size={11} aria-hidden />}
        label="Context"
        accentDot={summarizerRunning ? 'bg-info' : null}
      />
      <TabButton
        active={tab === 'plans'}
        onClick={() => onPick('plans')}
        icon={<ClipboardList size={11} aria-hidden />}
        label="Plans"
        badge={plansBadge}
        accentDot={plansWarning ? 'bg-warning' : null}
      />
      <TabButton
        active={tab === 'questions'}
        onClick={() => onPick('questions')}
        icon={<HelpCircle size={11} aria-hidden />}
        label="Questions"
        badge={questionsBadge}
        accentDot={questionsBadge ? 'bg-warning' : null}
      />
      <TabButton
        active={tab === 'terminal'}
        onClick={() => onPick('terminal')}
        icon={<SquareTerminal size={11} aria-hidden />}
        label="Terminal"
        accentDot={isTerminalOpen ? 'bg-info' : null}
      />
    </div>
  );
}

// TODO (@ak): split file
interface TabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly badge?: number | null;
  readonly accentDot?: string | null;
}

function TabButton({ active, onClick, icon, label, badge, accentDot }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold uppercase leading-none tracking-[0.06em] transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      {icon}
      {active ? <span>{label}</span> : null}
      {badge !== null && badge !== undefined ? (
        <span className="ml-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[9px] font-medium tracking-normal text-muted-foreground">
          {badge}
        </span>
      ) : null}
      {accentDot ? (
        <span aria-hidden className={cn('ml-0.5 size-1.5 rounded-full', accentDot)} />
      ) : null}
    </button>
  );
}

function PlansTabContent({ sessionId }: { sessionId: SessionId }) {
  const plans = useSessionPlans(sessionId);
  const loading = useSessionLoading(sessionId);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);
  const [modalOpen, setModalOpen] = useState(false);
  const [focusPlanId, setFocusPlanId] = useState<PlanId | null>(null);

  useEffect(() => {
    void loadSessionPlans(sessionId);
  }, [sessionId, loadSessionPlans]);

  if (plans.length === 0 && loading.plans) {
    return (
      <div className="flex flex-col gap-2 py-1">
        <PlansSkeleton />
      </div>
    );
  }
  if (plans.length === 0) {
    return <PlansEmpty />;
  }

  const openModal = (planId: PlanId) => {
    setFocusPlanId(planId);
    setModalOpen(true);
  };

  return (
    <>
      <ul
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1"
        style={{ scrollbarGutter: 'stable' }}
      >
        {plans.map((plan, idx) => (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => openModal(plan.id)}
              title={`Open plan ${idx + 1}, ${plan.title}`}
              className="group flex w-full items-start gap-2 rounded-lg bg-muted/30 p-2.5 text-left ring-1 ring-border-soft transition-colors hover:bg-muted/60"
            >
              <span
                aria-hidden
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20"
              >
                <ClipboardList size={11} className="text-primary" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs uppercase tracking-wide text-muted-foreground/70">
                    plan {idx + 1}
                  </span>
                  <span
                    className={cn(
                      'inline-flex w-20 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                      PLAN_STATUS_STYLE[plan.status],
                    )}
                  >
                    {PLAN_STATUS_LABEL[plan.status]}
                  </span>
                </div>
                <span className="line-clamp-2 text-xs font-medium text-foreground">
                  {plan.title}
                </span>
              </div>
              <ArrowUpRight
                size={11}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
              />
            </button>
          </li>
        ))}
      </ul>

      <PlansModal
        sessionId={sessionId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlanId={focusPlanId ?? plans[plans.length - 1]?.id}
      />
    </>
  );
}

interface FilesTouchedShape {
  readonly paths: ReadonlyArray<string>;
  readonly count: number;
  readonly additions: number;
  readonly deletions: number;
}

function ChangesStrip({
  sessionId,
  workingDir,
  filesTouched,
}: {
  sessionId: SessionId;
  workingDir: string | null;
  filesTouched: FilesTouchedShape;
}) {
  const [diffOpen, setDiffOpen] = useState(false);
  const count = filesTouched.count;

  return (
    <>
      <Divider />
      <div className="flex shrink-0 flex-col gap-2 pt-2.5">
        <GithubStrip sessionId={sessionId} />
        {count > 0 ? (
          <button
            type="button"
            onClick={() => setDiffOpen(true)}
            disabled={!workingDir}
            title={workingDir ? 'open the diff viewer' : 'no worktree for this session'}
            className="flex w-full items-center justify-between gap-2 rounded-lg bg-info/5 px-3 py-2 text-xs text-info ring-1 ring-info/20 transition-colors hover:bg-info/10 disabled:cursor-default disabled:opacity-60"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <FileEdit size={12} aria-hidden />
              <span className="truncate font-medium">
                {count} file{count === 1 ? '' : 's'} touched
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2">
              {filesTouched.additions > 0 || filesTouched.deletions > 0 ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums">
                  {filesTouched.additions > 0 ? (
                    <span className="text-success">+{filesTouched.additions}</span>
                  ) : null}
                  {filesTouched.deletions > 0 ? (
                    <span className="text-danger">−{filesTouched.deletions}</span>
                  ) : null}
                </span>
              ) : null}
              <ArrowUpRight size={12} aria-hidden className="opacity-70" />
            </span>
          </button>
        ) : (
          <div className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground/60 ring-1 ring-border-soft/40">
            <FileEdit size={12} aria-hidden />
            <span className="font-medium">working tree clean</span>
          </div>
        )}
        {count > 0 ? (
          <DiffViewerDialog
            open={diffOpen}
            onClose={() => setDiffOpen(false)}
            sessionId={sessionId}
            title={`${count} file${count === 1 ? '' : 's'} touched`}
            workingDir={workingDir ?? undefined}
            worktreePath={workingDir ?? undefined}
          />
        ) : null}
      </div>
    </>
  );
}

function GithubStrip({ sessionId }: { sessionId: SessionId }) {
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const pr = github?.pr ?? null;
  const loading = github?.loading ?? false;
  const error = github?.error ?? null;
  const openStudio = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-github-studio', { detail: { sessionId } }));

  const detail = github?.detail ?? null;
  const unresolvedComments = (detail?.comments ?? []).filter(
    (c) => c.source !== 'review' || c.resolved === false,
  ).length;
  const ciState = computeCiState(detail?.checks ?? []);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openStudio}
          title="open in github studio"
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 transition-colors hover:bg-foreground/5',
            pr
              ? 'ring-border-soft'
              : 'text-muted-foreground/70 ring-border-soft/40 hover:text-foreground',
          )}
        >
          {pr ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={11} />
              {ciState !== 'none' ? <CiBadge state={ciState} /> : null}
              {unresolvedComments > 0 ? (
                <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                  <MessageSquare size={11} aria-hidden />
                  <span className="tabular-nums">{unresolvedComments}</span>
                </span>
              ) : null}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <GitPullRequest size={12} aria-hidden />
              <span>No PR yet</span>
            </span>
          )}
          <ArrowUpRight size={12} aria-hidden className="shrink-0 opacity-70" />
        </button>
        <button
          type="button"
          onClick={() => void refreshSessionPr(sessionId, { force: true })}
          disabled={loading}
          title={error ? `refresh failed: ${error}` : 'refresh PR status'}
          aria-label="refresh PR status"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} aria-hidden className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>
      {error ? (
        <span className="px-1 text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

type CiState = 'success' | 'failure' | 'pending' | 'none';

function computeCiState(checks: ReadonlyArray<PrCheckRun>): CiState {
  if (checks.length === 0) return 'none';
  if (
    checks.some(
      (c) =>
        c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out',
    )
  ) {
    return 'failure';
  }
  if (checks.some((c) => c.conclusion === 'pending')) return 'pending';
  if (checks.some((c) => c.conclusion === 'success')) return 'success';
  return 'none';
}

function CiBadge({ state }: { state: CiState }) {
  const map: Record<CiState, { icon: LucideIcon; className: string; label: string }> = {
    success: { icon: GitPullRequestArrow, className: 'text-success', label: 'ci ✓' },
    failure: { icon: XCircle, className: 'text-danger', label: 'ci ✗' },
    pending: { icon: Clock, className: 'text-warning', label: 'ci …' },
    none: { icon: Clock, className: 'text-muted-foreground/40', label: 'no ci' },
  };
  const entry = map[state];
  const Icon = entry.icon;
  return (
    <span className={cn('inline-flex items-center gap-0.5', entry.className)}>
      <Icon size={11} aria-hidden />
      <span className="font-medium">{entry.label}</span>
    </span>
  );
}

function SlotRowSkeleton({ slotKey }: { slotKey: SlotKey }) {
  return (
    <li role="status" aria-label={`loading ${slotKey}`} className="flex flex-col gap-2">
      <div className="h-2.5 w-20 rounded bg-muted/50" />
      <div className="h-3 w-full rounded bg-muted/50" />
      <div className="h-3 w-3/4 rounded bg-muted/50" />
    </li>
  );
}

function PlansSkeleton() {
  return (
    <div role="status" aria-label="loading plans" className="flex flex-col gap-2 pb-2">
      <div className="h-2.5 w-16 rounded bg-muted/50" />
      <div className="h-3 w-full rounded bg-muted/50" />
      <div className="h-3 w-2/3 rounded bg-muted/50" />
    </div>
  );
}

interface SlotMeta {
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly iconChipBg: string;
  readonly description: string;
  readonly emphasis?: boolean;
  /** Tailwind ring-* class to swap the default border-soft ring when hasValue. */
  readonly accentRingWhenNonEmpty?: string;
  readonly emptyLabel: string;
  readonly emptyCta: string;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly singleLine?: boolean;
  // Read-only slots can't be hand-edited by the user. When empty the row
  // collapses to an inactive label (no CTA, no click) and switches to the
  // canvas bg so it visually recedes vs. the live slots.
  readonly readOnly?: boolean;
}

const MARKDOWN_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>([
  'open_questions',
  'decisions',
  'last_output_summary',
]);

const SLOT_META: Record<Exclude<SlotKey, 'files_touched'>, SlotMeta> = {
  goal: {
    icon: Target,
    iconClass: 'text-primary',
    iconChipBg: 'bg-primary/10 ring-primary/20',
    description: 'What this session is set out to achieve',
    emphasis: true,
    singleLine: true,
    emptyLabel: 'No goal yet',
    emptyCta: 'Add the session goal',
  },
  open_questions: {
    icon: HelpCircle,
    iconClass: 'text-warning',
    iconChipBg: 'bg-warning/10 ring-warning/20',
    description: 'Things the agent still needs clarified',
    accentRingWhenNonEmpty: 'ring-warning/60',
    emptyLabel: 'No open questions',
    emptyCta: '',
    readOnly: true,
  },
  decisions: {
    icon: CheckCheck,
    iconClass: 'text-success',
    iconChipBg: 'bg-success/10 ring-success/20',
    description: 'Choices already locked in for this session',
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'No decisions yet',
    emptyCta: 'Log a decision',
  },
  last_output_summary: {
    icon: Activity,
    iconClass: 'text-info',
    iconChipBg: 'bg-info/10 ring-info/20',
    description: "Summary of the assistant's most recent reply",
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'No output yet',
    emptyCta: 'Write a manual summary',
  },
};

function countMarkdownItems(value: string): number {
  return value.split('\n').filter((l) => /^\s*([-*+]|\d+\.)\s+/.test(l)).length;
}

function firstMeaningfulLine(value: string): string {
  for (const raw of value.split('\n')) {
    const t = raw
      .trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^#+\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '');
    if (t) return t;
  }
  return '';
}

function normalizeFilesSlot(slot: ContextSlot, workingDir: string | null): ContextSlot {
  if (!workingDir || slot.value.length === 0) return slot;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  const normalized = slot.value
    .split('\n')
    .map((p) => (p.startsWith(root) ? p.slice(root.length) : p))
    .join('\n');
  return normalized === slot.value ? slot : { ...slot, value: normalized };
}

// TODO (@ak): split file
interface SlotRowProps {
  sessionId: SessionId;
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  loading?: boolean;
  isSummarizing?: boolean;
  onCommit: (value: string) => void;
}

function SlotRow({
  sessionId,
  slotKey,
  slot,
  loading = false,
  isSummarizing = false,
  onCommit,
}: SlotRowProps) {
  const value = slot?.value ?? '';
  const meta = slotKey === 'files_touched' ? null : SLOT_META[slotKey];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(meta?.defaultCollapsed ?? false);

  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const history = useSlotHistory(sessionId, slotKey);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const openHistory = useCallback(() => {
    void loadSlotHistory(sessionId, slotKey);
    setHistoryOpen(true);
  }, [loadSlotHistory, sessionId, slotKey]);

  const restore = useCallback(
    (entry: ContextSlotHistoryEntry) => {
      onCommit(entry.value);
      setHistoryOpen(false);
    },
    [onCommit],
  );

  // Per-slot skeleton: while the slots fetch is still in flight and this
  // particular slot hasn't materialized yet, show a placeholder. Sibling
  // slots that already arrived render their content independently. Must
  // come after all hook calls, React requires a stable hook order across
  // renders, and slot can flip between undefined/defined on workspace switch.
  if (slot === undefined && loading) return <SlotRowSkeleton slotKey={slotKey} />;

  const Icon = meta?.icon;
  const hasValue = value.length > 0;
  const renderAsMarkdown = MARKDOWN_SLOTS.has(slotKey);
  const collapsible = meta?.collapsible ?? false;
  const singleLine = meta?.singleLine ?? false;
  const itemCount = collapsible && hasValue ? countMarkdownItems(value) : 0;
  const preview = collapsible && hasValue ? firstMeaningfulLine(value) : '';
  const CollapseIcon = collapsed ? ChevronRight : ChevronDown;

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const itemCountLabel =
    hasValue && itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : null;

  const headerToggle = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((v) => !v)}
      title={collapsed ? 'Expand' : 'Collapse'}
      aria-expanded={!collapsed}
      className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
    >
      <CollapseIcon size={11} aria-hidden />
    </button>
  ) : null;

  // Empty slot → blends into the panel bg (no surface). Slot with content →
  // a step brighter so it reads as "active / has signal." Same rule for every
  // slot regardless of read-only, emptiness is the only switch.
  const inactive = !hasValue;
  const ringClass = inactive
    ? 'ring-border-soft/30'
    : (meta?.accentRingWhenNonEmpty ?? 'ring-border-soft');

  return (
    <li
      className={cn(
        'group relative flex flex-none flex-col gap-2 rounded-lg p-3 ring-1 transition-colors',
        inactive ? 'bg-transparent' : 'bg-muted/40',
        ringClass,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            aria-hidden
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-md ring-1',
              meta?.iconChipBg,
            )}
          >
            <Icon size={11} className={meta?.iconClass} aria-hidden />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
            <span>{SLOT_LABELS[slotKey]}</span>
            {itemCountLabel ? (
              <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
                · {itemCountLabel}
              </span>
            ) : null}
          </span>
          {meta?.description ? (
            <span className="text-[10px] leading-tight text-muted-foreground/60">
              {meta.description}
            </span>
          ) : null}
        </div>
        {/* History first, then chevron at the far right. The history button
            stays hidden until we already have entries in cache, listing it
            without loading would force a per-slot fetch on every render. */}
        {history.length > 0 ? (
          <button
            type="button"
            onClick={openHistory}
            title="View history"
            aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <History size={11} aria-hidden />
          </button>
        ) : null}
        {headerToggle}
      </div>

      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(value);
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          className="font-mono text-xs"
          autoGrow
          maxRows={16}
        />
      ) : !hasValue ? (
        meta?.readOnly ? (
          <span className="text-xs text-muted-foreground/50">{meta.emptyLabel}</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isSummarizing) return;
              setEditing(true);
            }}
            disabled={isSummarizing}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded text-left text-xs text-muted-foreground/60 transition-colors',
              isSummarizing ? 'cursor-default' : 'hover:text-foreground',
            )}
          >
            <span>{meta?.emptyLabel ?? 'Empty'}</span>
            <span className="text-[10px] text-muted-foreground/40 underline-offset-2 group-hover:underline">
              {meta?.emptyCta ?? 'Click to edit'}
            </span>
          </button>
        )
      ) : singleLine ? (
        <button
          type="button"
          onClick={() => {
            if (isSummarizing) return;
            setEditing(true);
          }}
          disabled={isSummarizing}
          title={value}
          className={cn(
            'rounded text-left text-sm font-medium leading-snug text-foreground transition-colors',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/5',
          )}
        >
          {value}
        </button>
      ) : collapsible && collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand"
          className="flex w-full cursor-pointer items-center gap-1.5 truncate rounded text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="truncate">{preview}</span>
        </button>
      ) : renderAsMarkdown ? (
        <div
          role={isSummarizing ? undefined : 'button'}
          tabIndex={isSummarizing ? -1 : 0}
          onClick={() => {
            if (isSummarizing) return;
            setEditing(true);
          }}
          onKeyDown={(e) => {
            if (isSummarizing) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'rounded text-left leading-relaxed transition-colors [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/15 [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all',
            isSummarizing ? 'cursor-default' : 'cursor-text',
          )}
        >
          <Markdown text={value} className="text-[13px] text-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (isSummarizing) return;
            setEditing(true);
          }}
          disabled={isSummarizing}
          className={cn(
            'whitespace-pre-wrap break-words rounded text-left leading-relaxed transition-colors',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/5',
            meta?.emphasis ? 'text-sm font-medium' : 'text-xs',
          )}
        >
          {value}
        </button>
      )}

      <SlotHistoryDialog
        label={SLOT_LABELS[slotKey]}
        renderAsMarkdown={renderAsMarkdown}
        open={historyOpen}
        entries={history}
        onRestore={restore}
        onClose={() => setHistoryOpen(false)}
      />
    </li>
  );
}

// TODO (@ak): split file
interface SlotHistoryDialogProps {
  label: string;
  renderAsMarkdown: boolean;
  open: boolean;
  entries: ReadonlyArray<ContextSlotHistoryEntry>;
  onRestore: (entry: ContextSlotHistoryEntry) => void;
  onClose: () => void;
}

function SlotHistoryDialog({
  label,
  renderAsMarkdown,
  open,
  entries,
  onRestore,
  onClose,
}: SlotHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`history: ${label}`} size="xl">
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">no history yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
                    entry.author === 'user' ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info',
                  )}
                >
                  {entry.author === 'user' ? 'you' : 'ai'}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {formatRelative(entry.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  title="restore this version"
                  aria-label="restore"
                  className="ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw size={10} aria-hidden />
                  restore
                </button>
              </div>
              {renderAsMarkdown ? (
                <div className="max-h-40 overflow-hidden text-xs leading-relaxed text-foreground">
                  <Markdown text={entry.value} className="text-xs" />
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground line-clamp-4">
                  {entry.value}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SummarizerBadge({
  sessionId,
  status,
  lastUpdate,
  error,
  totals,
  canRetry,
}: {
  sessionId: SessionId;
  status: SummarizerStatusKind;
  lastUpdate: string | null;
  error: string | null;
  totals: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
    readonly count: number;
  };
  canRetry: boolean;
}) {
  const retrySummarizer = useAppStore((s) => s.retrySummarizer);
  const [retrying, setRetrying] = useState(false);

  // Reset the retry-spin once the run actually kicks off, the store flips
  // status to 'running' synchronously, but the icon-only spin is what tells
  // the user their click was registered.
  useEffect(() => {
    if (status !== 'error') setRetrying(false);
  }, [status]);

  const costTooltip =
    totals.count === 0
      ? 'summarizer has not run yet'
      : `summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · $${totals.estimatedCostUsd.toFixed(4)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`;

  const costPill = (
    <span
      title={costTooltip}
      className="rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground"
    >
      Σ ${totals.estimatedCostUsd.toFixed(4)}
    </span>
  );

  // Running state: small spinner glyph next to the cost pill. Replaces the
  // earlier full-panel spin-border, which forced a 400×800px composite layer
  // with a conic-gradient + mask-composite animation, the heaviest CSS shape
  // possible on WKWebView. With 5 keep-alive ContextPanels each potentially
  // wearing one, the GPU compositor stalled for 200-300ms during cursor
  // movement (verified via Web Inspector perf trace). A 10px Loader2 is one
  // tiny layer, negligible cost.
  if (status === 'running') {
    return (
      <span className="flex items-center gap-1">
        <Loader2 size={10} aria-hidden className="animate-spin text-info" />
        {costPill}
      </span>
    );
  }

  if (status === 'error') {
    const errorTitle = error ? `cannot summarize · ${error}` : 'cannot summarize';
    return (
      <span className="flex items-center gap-1">
        {costPill}
        <button
          type="button"
          onClick={() => {
            if (!canRetry || retrying) return;
            setRetrying(true);
            retrySummarizer(sessionId);
          }}
          disabled={!canRetry}
          title={canRetry ? `${errorTitle}, click to retry` : errorTitle}
          aria-label={canRetry ? 'retry summarizer' : 'summarizer failed'}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-2xs uppercase tracking-wide text-danger transition-colors',
            canRetry
              ? 'hover:bg-danger/15 hover:text-danger-foreground/90'
              : 'cursor-not-allowed opacity-70',
          )}
        >
          <AlertTriangle size={10} aria-hidden />
          Cannot summarize
          <RotateCw size={10} aria-hidden className={cn('shrink-0', retrying && 'animate-spin')} />
        </button>
      </span>
    );
  }

  return costPill;
}

const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  active: 'bg-warning/10 text-warning',
  consumed: 'bg-info/10 text-info',
  superseded: 'bg-muted text-muted-foreground',
  discarded: 'bg-muted/60 text-muted-foreground/70 line-through',
};

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'Active',
  consumed: 'Consumed',
  superseded: 'Superseded',
  discarded: 'Discarded',
};

function PlansEmpty() {
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-transparent p-3 ring-1 ring-border-soft/30">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20"
        >
          <ClipboardList size={11} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
            Plans
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground/60">
            Step-by-step plans queued for this session
          </span>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground/70">
        No plans yet. Spawn a <span className="font-medium text-foreground">Plan</span> agent and
        ask it to map the work, its output lands here, ready to feed an Implement agent.
      </p>
    </section>
  );
}
