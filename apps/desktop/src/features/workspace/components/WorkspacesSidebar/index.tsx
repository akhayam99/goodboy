import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createPortal } from 'react-dom';
import { Button, Dialog, Divider, Popover, ScrollArea, cn } from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FolderPlus,
  Gauge,
  GitPullRequest,
  HelpCircle,
  Layers,
  Loader2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { AutoRunToggle } from '../../../session/components/AutoRunToggle';
import { SessionSettingsDialog } from '../../../session/components/SessionSettingsDialog';
import { GuideDialog } from '../../../settings/components/GuideDialog';
import { NotificationCenter } from '../../../../features/notifications/components/NotificationCenter';
import { PricingDialog } from '../../../providers/components/PricingDialog';
import { MAX_WORKSPACES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../updater/components/UpdateIndicator';
import { OnboardingChip } from '../../../onboarding/OnboardingCard';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  Session,
  SessionId,
  Step,
  TelemetryRecord,
  TurnState,
  Workflow,
  WorkspaceId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessions,
  useWorkspaces,
} from '../../../../store';
import { NewSessionDialog } from '../../../session/components/NewSessionDialog';
import { StartWorkflowDialog } from '../../../session/components/StartWorkflowDialog';
import { pickNextWorkflowStep } from '../../../../features/workflows/components/WorkflowNextStepCta';
import { workflowHasOpenQuestions } from '../../../../features/context/openQuestionsGate';
import {
  computeLatestTelemetryByAgentId,
  formatCost,
  formatTokens,
} from '../../../../features/session/agent-row-format';
import { PROVIDER_CAPABILITIES, WORKFLOW_LIBRARY } from '@goodboy/core';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  AGENT_KIND_ORDER,
  AGENT_KIND_PALETTE,
  type AgentKind,
  inferAgentKindFromName,
  resolveAgentKind,
} from '../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../features/session/components/AgentKindChip';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../features/session/components/AgentMetricsBlock';
import { formatError } from '../../../../shared/lib/errors';
import { useThemeStore } from '../../../../shared/lib/theme';
import { WorkspaceSelect } from '../WorkspaceSelect';
import { WorkspaceLinkDialog } from '../WorkspaceLinkDialog';
import { SessionActivityBar } from '../SessionActivityBar';
import { SessionDetailPanel, SessionMetaFooter } from '../SessionDetailPanel';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { useNow } from '../../../../shared/hooks/useNow';

interface WorkspacesSidebarProps {
  onOpenSettings: () => void;
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenGithub: () => void;
  collapsed?: boolean;
  onToggleCollapse: () => void;
}

const FOOTER_ICON_BTN =
  'flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50' as const;

const SECTION_LABEL =
  'flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground' as const;

export function WorkspacesSidebar({
  onOpenSettings,
  onOpenPalette,
  onOpenWorkflows,
  onOpenLinear,
  onOpenGithub,
  collapsed = false,
  onToggleCollapse,
}: WorkspacesSidebarProps) {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  // Linear Studio is gated on the workspace having a connected Linear
  // integration; defensive `?.` because tests mock a shallow store.
  const hasLinear = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'linear',
    ),
  );
  const currentSession = useCurrentSession();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const onSelectSession = useCallback(
    (id: SessionId) => {
      void setCurrentSession(id);
    },
    [setCurrentSession],
  );
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  // `sessions` from the store is now archive-free by construction. Archived
  // sessions live in `archivedSessions[workspaceId]`, loaded lazily when the
  // Archived tab opens (see SessionActivityBar's onArchivedOpen).
  const activeSessions = sessions;
  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const archiveTaskAction = useAppStore((s) => s.archiveTask);
  const unarchiveTaskAction = useAppStore((s) => s.unarchiveTask);
  const archive = useCallback(
    (id: SessionId) => {
      void archiveTaskAction(id);
    },
    [archiveTaskAction],
  );
  const unarchive = useCallback(
    (id: SessionId) => {
      void unarchiveTaskAction(id);
    },
    [unarchiveTaskAction],
  );
  const onArchivedTabOpen = useCallback(() => {
    if (!currentWorkspace) return;
    void loadArchivedSessions(currentWorkspace.id);
  }, [currentWorkspace, loadArchivedSessions]);
  // currentSession may live in either pool, useCurrentSession looks up both
  //, so the dialog's `archived` flag needs to read from the session itself.
  const isCurrentArchived = !!currentSession?.archivedAt;

  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (!collapsed && currentWorkspace) setNewSessionOpen(true);
    };
    window.addEventListener('goodboy:new-session', handler);
    return () => window.removeEventListener('goodboy:new-session', handler);
  }, [collapsed, currentWorkspace]);

  if (collapsed) {
    return <CollapsedSidebarRail onExpand={onToggleCollapse} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* workspace select */}
      <div className="shrink-0">
        <WorkspaceSelect onAddWorkspace={() => setAddWorkspaceOpen(true)} />
      </div>

      <Divider />

      {/* unified master-detail card, sessions rail + selected-session detail */}
      <div className="flex min-h-0 flex-1">
        {currentWorkspace ? (
          (() => {
            const totalSessions = activeSessions.length + archivedSessions.length;
            const hasAnySession = totalSessions > 0;
            return (
              <div className="mx-3 my-3 flex min-h-0 flex-1 overflow-hidden">
                {/* Sessions rail, always visible while a workspace is current.
                    Earlier builds collapsed it when totalSessions <= 1, which
                    moved the "new session" affordance into the detail header.
                    That morphing made it hard to teach; now the rail is the
                    single home for session navigation and creation. */}
                <div className="w-28 shrink-0 overflow-hidden">
                  <SessionActivityBar
                    workspaceId={currentWorkspace.id}
                    sessions={activeSessions}
                    archivedSessions={archivedSessions}
                    currentSessionId={currentSession?.id ?? null}
                    onSelectSession={onSelectSession}
                    onNewSession={() => setNewSessionOpen(true)}
                    onArchivedTabOpen={onArchivedTabOpen}
                  />
                </div>
                {/* Inset hairline divider between rail and detail. */}
                <div
                  aria-hidden
                  className="ml-1.5 my-1 w-px shrink-0 bg-gradient-to-b from-transparent via-border-soft via-30% to-transparent"
                />
                {/* selected-session detail */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {currentSession ? (
                    <>
                      <SessionDetailPanel
                        session={currentSession}
                        onOpenSessionSettings={() => setSessionSettingsOpen(true)}
                      />
                      <ScrollArea className="min-h-0 flex-1">
                        <AgentsSection task={currentSession} />
                      </ScrollArea>
                      <SessionMetaFooter session={currentSession} />
                    </>
                  ) : (
                    /* No detail panel content when no session is selected: the
                       sessions rail on the left already offers selection and
                       creation, and the chat area renders the primary hero. */
                    <SidebarDetailHint hasAnySession={hasAnySession} />
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <NoWorkspaceEmpty onAddWorkspace={() => setAddWorkspaceOpen(true)} />
        )}
      </div>

      <Divider />

      {/* quick actions, jump straight into the palette pre-scoped to a
          source. Discovery aid for the prefix grammar (plan §A.2/§A.3). */}
      {currentWorkspace ? (
        <QuickActionsRow
          onOpenPalette={onOpenPalette}
          onOpenWorkflows={onOpenWorkflows}
          onOpenLinear={onOpenLinear}
          onOpenGithub={onOpenGithub}
          linearEnabled={hasLinear}
          skillsEnabled={WORKSPACE_FEATURES.skills}
        />
      ) : null}

      {/* sidebar footer, logo + onboarding chip + controls */}
      <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-3">
        <SidebarLogo />
        <div className="flex-1" />
        <OnboardingChip />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="collapse sidebar (⌘B)"
            aria-label="collapse sidebar"
            className={FOOTER_ICON_BTN}
          >
            <PanelLeftClose size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPricingOpen(true)}
            title="open spend & pricing"
            aria-label="open spend and pricing"
            className={FOOTER_ICON_BTN}
          >
            <DollarSign size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            className={FOOTER_ICON_BTN}
          >
            {theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
          </button>
          <NotificationCenter />
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            title="getting started"
            aria-label="open getting started guide"
            className={FOOTER_ICON_BTN}
          >
            <HelpCircle size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title="settings (⌘,)"
            aria-label="open settings"
            className={FOOTER_ICON_BTN}
          >
            <Settings size={14} aria-hidden />
          </button>
        </div>
      </div>

      {/* Mount these heavy dialogs only when open. Otherwise their inner
          selectors (PricingDialog subscribes to session/workspace summaries,
          sessionTelemetry, providerSpendBreakdown, GuideDialog walks a few
          maps too) re-evaluate on every store update for a panel the user
          almost never has open. */}
      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
      {guideOpen ? <GuideDialog open onClose={() => setGuideOpen(false)} /> : null}
      {pricingOpen ? <PricingDialog open onClose={() => setPricingOpen(false)} /> : null}
      {currentWorkspace && newSessionOpen ? (
        <NewSessionDialog
          open
          onClose={() => setNewSessionOpen(false)}
          workspaceId={currentWorkspace.id}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
      {currentSession && sessionSettingsOpen ? (
        <SessionSettingsDialog
          sessionId={currentSession.id as SessionId}
          open
          onClose={() => setSessionSettingsOpen(false)}
          archived={isCurrentArchived}
          onArchive={() => archive(currentSession.id as SessionId)}
          onUnarchive={() => unarchive(currentSession.id as SessionId)}
        />
      ) : null}
    </div>
  );
}

// Collapsed left sidebar, a minimal rail (just an expand affordance), the
// left-side mirror of the ContextPanel's collapsed state. The rail width is
// fixed by AppShell's LEFT_RAIL_WIDTH.
function CollapsedSidebarRail({ onExpand }: { onExpand: () => void }) {
  // Logo pinned top, expand control pinned bottom, the expand button holds
  // the same bottom slot it occupies in the expanded sidebar's footer, so it
  // doesn't jump when the rail toggles.
  return (
    <div className="flex h-full w-full flex-col items-center justify-between py-3">
      <DogMascot size={18} className="shrink-0 text-foreground" />
      <button
        type="button"
        onClick={onExpand}
        title="expand sidebar (⌘B)"
        aria-label="expand sidebar"
        className={FOOTER_ICON_BTN}
      >
        <PanelLeftOpen size={16} aria-hidden />
      </button>
    </div>
  );
}

function QuickActionsRow({
  onOpenPalette,
  onOpenWorkflows,
  onOpenLinear,
  onOpenGithub,
  linearEnabled,
  skillsEnabled,
}: {
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenGithub: () => void;
  linearEnabled: boolean;
  skillsEnabled: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 pt-2">
      {skillsEnabled ? (
        <QuickAction
          icon={<Sparkles size={12} aria-hidden />}
          label="Skills"
          onClick={() => onOpenPalette('/')}
        />
      ) : null}
      {/* Single entry point to the global Workflow Studio. Scripts is reachable
          from the composer ($ prefix) and the palette, so it's dropped here. */}
      <QuickAction
        icon={<Layers size={12} aria-hidden />}
        label="Workflows"
        onClick={onOpenWorkflows}
      />
      {/* Linear Studio: launch sessions straight from assigned issues. Shown
          only when this workspace has Linear connected. */}
      {linearEnabled ? (
        <QuickAction
          icon={
            <span className="flex size-3 items-center justify-center rounded-[3px] bg-[#5e6ad2] text-[7px] font-bold text-white">
              L
            </span>
          }
          label="Linear"
          title="launch a session from a Linear issue"
          onClick={onOpenLinear}
        />
      ) : null}
      <QuickAction
        icon={<GitPullRequest size={12} aria-hidden />}
        label="GitHub"
        title="review and act on pull requests across this workspace"
        onClick={onOpenGithub}
      />
    </div>
  );
}

function QuickAction({
  icon,
  label,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `browse ${label.toLowerCase()} in the command palette`}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-soft bg-muted/30 py-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function WorkflowKindLabel({ workflow }: { workflow: Workflow }) {
  const presetName = useMemo(() => {
    const needle = workflow.name.trim().toLowerCase();
    if (!needle) return null;
    const match = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === needle);
    return match?.name.toLowerCase() ?? null;
  }, [workflow.name]);

  const label = presetName ?? 'custom';
  const isPreset = presetName !== null;
  return (
    <span
      title={isPreset ? `${label} preset` : 'custom workflow'}
      className="min-w-0 max-w-[8rem] truncate text-2xs text-muted-foreground/70"
    >
      {label}
    </span>
  );
}

/**
 * Inline follow-up CTA rendered directly above the generic 'Create agent'
 * trigger when the session has an active plan ready to execute. The pitch is:
 * before the user picks any role from the spawn menu, the plan already
 * implies the answer, so offer it one click away.
 *
 * Visibility guards:
 *   - latest plan status is 'active' (a 'consumed' plan already has an
 *     implementer attached; no need to suggest again)
 *   - no open questions on the session (the user owes the agent an answer
 *     first; a spawn CTA on top would be noise)
 *   - if the session has a workflow whose next un-spawned step is itself an
 *     implementer, defer to WorkflowNextStepCta, two CTAs for the same
 *     action would compete
 *
 * Click goes through the store's runPlan, which (since the runPlan fix in
 * this branch) seeds an implementer agent with the plan body as kickoff.
 */
function PlanReadySuggestion({ task }: { task: Session }) {
  const plans = useSessionPlans(task.id);
  const openQuestions = useSessionOpenQuestions(task.id);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const runPlan = useAppStore((s) => s.runPlan);
  const [spawning, setSpawning] = useState(false);

  const latest = plans[plans.length - 1];
  if (!latest || latest.status !== 'active') return null;

  // Per-workflow gate: find the workflow that owns the plan creator's step
  // and block only if THAT workflow has open questions. Plans without a
  // workflow context (ad-hoc creator) fall back to the orphan-or-any check.
  const creator = phaseRuns.find((r) => r.id === latest.agentId);
  const creatorWorkflow = creator?.stepId
    ? (phaseTemplates.find((t) => t.steps.some((s) => s.id === creator.stepId)) ?? null)
    : null;
  if (creatorWorkflow) {
    if (workflowHasOpenQuestions(openQuestions, creatorWorkflow.id)) return null;
  } else if (openQuestions.some((q) => q.status === 'open')) {
    // No workflow context, keep legacy session-wide block (safe default).
    return null;
  }

  for (const wid of task.workflowIds) {
    const workflow = phaseTemplates.find((t) => t.id === wid);
    if (!workflow) continue;
    const nextStep = pickNextWorkflowStep(workflow, phaseRuns);
    if (nextStep && inferAgentKindFromName(nextStep.name) === 'implementer') return null;
  }

  const onSpawn = async () => {
    if (spawning) return;
    setSpawning(true);
    try {
      await runPlan(task.id, latest.id);
    } finally {
      setSpawning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onSpawn()}
      disabled={spawning}
      data-testid="plan-ready-suggestion"
      title={latest.title}
      aria-label={`spawn an implementer agent to execute the plan: ${latest.title}`}
      className="group mt-1 flex w-full items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-2 text-left transition-colors hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary',
          spawning && 'animate-pulse',
        )}
        aria-hidden
      >
        {spawning ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          <span>plan ready</span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            spawn implementer
          </span>
        </span>
        <span className="line-clamp-2 text-xs text-foreground/90">{latest.title}</span>
      </span>
      <ArrowRight
        size={12}
        aria-hidden
        className="mt-0.5 shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </button>
  );
}

function SidebarLogo() {
  return (
    <span className="flex items-center gap-1.5">
      <DogMascot size={16} className="shrink-0 text-foreground" />
      <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
      <UpdateIndicator variant="pip" />
    </span>
  );
}

function SidebarDetailHint({ hasAnySession }: { hasAnySession: boolean }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <p className="text-2xs leading-relaxed text-muted-foreground/70">
        {hasAnySession
          ? 'Select a session from the rail.'
          : 'Create your first session from the rail.'}
      </p>
    </div>
  );
}

function NoWorkspaceEmpty({ onAddWorkspace }: { onAddWorkspace: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-full bg-info/10 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-info/10">
          <FolderPlus size={26} className="text-info" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">No workspace yet</h3>
        <p className="max-w-[220px] text-2xs leading-relaxed text-muted-foreground">
          Add a git repo to create worktrees and start orchestrating sessions.
        </p>
      </div>
      <button
        type="button"
        onClick={onAddWorkspace}
        className="inline-flex items-center gap-1.5 rounded-md bg-info/15 px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/25"
      >
        <Plus size={12} aria-hidden />
        <span>Add workspace</span>
      </button>
    </div>
  );
}

interface AgentsSectionProps {
  task: Session;
}

function AgentsSection({ task }: AgentsSectionProps) {
  const isTaskActive = useAppStore((s) => s.currentSessionId === task.id);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const messages = useAppStore((s) => s.messages[task.id] ?? EMPTY_ARRAY);
  // Scope cross-agent maps to this session's runs. Subscribing to the raw
  // store map (`s.agentRunHistory` etc.) re-renders this section every time
  // any agent anywhere in the app updates, useShallow narrows the
  // subscription to "did any of *my* runs' entries change".
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReadonlyArray<ProviderRunId>> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) return out;
      for (const run of runs) {
        const history = s.agentRunHistory[run.id];
        if (history) out[run.id] = history;
      }
      return out;
    }),
  );
  const agentKindOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, AgentKind> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) return out;
      for (const run of runs) {
        const kind = s.agentKindOverride[run.id];
        if (kind) out[run.id] = kind;
      }
      return out;
    }),
  );
  const agentModelOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, string> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) return out;
      for (const run of runs) {
        const model = s.agentModelOverride[run.id];
        if (model) out[run.id] = model;
      }
      return out;
    }),
  );
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const deleteAgent = useAppStore((s) => s.deleteAgent);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const attachedWorkflows = useMemo<ReadonlyArray<Workflow>>(
    () =>
      task.workflowIds
        .map((wid) => phaseTemplates.find((t) => t.id === wid))
        .filter((t): t is Workflow => t !== undefined),
    [task.workflowIds, phaseTemplates],
  );
  const detachWorkflowFromSession = useAppStore((s) => s.detachWorkflowFromSession);
  const reorderSessionWorkflows = useAppStore((s) => s.reorderSessionWorkflows);
  const openQuestions = useSessionOpenQuestions(task.id);
  const loading = useSessionLoading(task.id);
  const summarizerBusy = useAppStore((s) => s.summarizerStatus[task.id]?.status === 'running');
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [startWorkflowOpen, setStartWorkflowOpen] = useState(false);
  const [editingId, setEditingId] = useState<AgentId | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail;
      if (!detail?.sessionId || detail.sessionId === task.id) {
        setStartWorkflowOpen(true);
      }
    };
    window.addEventListener('goodboy:open-workflow-picker', handler);
    return () => window.removeEventListener('goodboy:open-workflow-picker', handler);
  }, [task.id]);

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);
  const stepWorkflowById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wf of attachedWorkflows) {
      for (const step of wf.steps) map.set(step.id, wf.id);
    }
    return map;
  }, [attachedWorkflows]);
  const agentsByWorkflowId = useMemo(() => {
    const map = new Map<string, ReadonlyArray<Agent>>();
    for (const wf of attachedWorkflows) {
      map.set(
        wf.id,
        sorted.filter((r) => r.stepId != null && stepWorkflowById.get(r.stepId) === wf.id),
      );
    }
    return map;
  }, [attachedWorkflows, sorted, stepWorkflowById]);
  const adHocAgents = useMemo(
    () => sorted.filter((r) => r.stepId == null || !stepWorkflowById.has(r.stepId)),
    [sorted, stepWorkflowById],
  );
  const actionableStepIdByWorkflowId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const wf of attachedWorkflows) {
      const wfAgents = agentsByWorkflowId.get(wf.id) ?? EMPTY_ARRAY;
      map.set(wf.id, pickNextWorkflowStep(wf, wfAgents)?.id ?? null);
    }
    return map;
  }, [attachedWorkflows, agentsByWorkflowId]);
  // Per-workflow block state: each workflow is gated by its own open
  // questions (plus session-wide summarizer / orphan questions). Set true
  // when the workflow can't auto-advance until the user resolves something.
  const blockedByWorkflowId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const wf of attachedWorkflows) {
      map.set(wf.id, workflowHasOpenQuestions(openQuestions, wf.id) || summarizerBusy);
    }
    return map;
  }, [attachedWorkflows, openQuestions, summarizerBusy]);

  const onDetachWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        await detachWorkflowFromSession(task.id, workflowId as Workflow['id']);
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [detachWorkflowFromSession, task.id],
  );

  const onReorderWorkflow = useCallback(
    async (workflowId: string, direction: 'up' | 'down') => {
      const ids = [...task.workflowIds];
      const idx = ids.indexOf(workflowId as Workflow['id']);
      if (idx === -1) return;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= ids.length) return;
      [ids[idx], ids[swap]] = [ids[swap]!, ids[idx]!];
      try {
        await reorderSessionWorkflows(task.id, ids);
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [reorderSessionWorkflows, task.id, task.workflowIds],
  );

  const telemetryByRunId = useMemo(() => {
    const map = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      const existing = map.get(rec.runId);
      if (!existing || existing.recordedAt < rec.recordedAt) {
        map.set(rec.runId, rec);
      }
    }
    return map;
  }, [telemetry]);

  const turnsByAgentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      if (m.role !== 'user') continue;
      map.set(m.agentId, (map.get(m.agentId) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  // First user message per agent, kept stable so the chip's auto-label only
  // ever derives from turn #1 even if later turns arrive.
  const firstUserTextByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.role !== 'user') continue;
      if (map.has(m.agentId)) continue;
      map.set(m.agentId, m.content);
    }
    return map;
  }, [messages]);

  /**
   * Cumulative telemetry per agent across every providerRun we recorded for
   * that agent, needed so the cost/tokens row in the sidebar doesn't drop
   * earlier providers' usage when the user swaps provider mid-session.
   */
  const aggregatesByAgentId = useMemo(() => {
    const map = new Map<
      string,
      { inputTokens: number; outputTokens: number; estimatedCostUsd: number; turns: number }
    >();
    const telemetryByRun = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      if (rec.kind !== 'turn') continue;
      const existing = telemetryByRun.get(rec.runId);
      if (!existing || existing.recordedAt < rec.recordedAt) {
        telemetryByRun.set(rec.runId, rec);
      }
    }
    for (const run of phaseRuns) {
      const runIds = agentRunHistory[run.id] ?? (run.runId ? [run.runId] : []);
      let inputTokens = 0;
      let outputTokens = 0;
      let estimatedCostUsd = 0;
      let turns = 0;
      for (const rid of runIds) {
        const rec = telemetryByRun.get(rid);
        if (!rec) continue;
        inputTokens += rec.inputTokens;
        outputTokens += rec.outputTokens;
        estimatedCostUsd += rec.estimatedCostUsd;
        turns += 1;
      }
      map.set(run.id, { inputTokens, outputTokens, estimatedCostUsd, turns });
    }
    return map;
  }, [telemetry, phaseRuns, agentRunHistory]);

  /**
   * Most recent turn telemetry per agent, walks agentRunHistory newest-first so
   * the context bar always shows the latest prompt size, even if Session.runId
   * lags behind (e.g. the DB row wasn't flushed before telemetry arrived).
   */
  const latestTelemetryByAgentId = useMemo(
    () => computeLatestTelemetryByAgentId(phaseRuns, agentRunHistory, telemetryByRunId),
    [telemetryByRunId, phaseRuns, agentRunHistory],
  );

  const onPickAgent = (sid: AgentId) => {
    if (sid === selectedAgentId) return;
    void selectAgent(task.id, sid);
  };

  const onSpawn = async (stepId: Step['id'] | null, model?: string) => {
    setSpawnError(null);
    try {
      if (stepId) {
        const existing = sorted.find((r) => r.stepId === stepId && r.status === 'pending');
        if (existing) {
          await activateWorkflowAgent(task.id, existing.id);
          return;
        }
      }
      await spawnAgent(task.id, stepId ? { stepId, ...(model !== undefined && { model }) } : {});
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const onRenameCommit = async (id: AgentId, name: string) => {
    setEditingId(null);
    try {
      await renameAgent(task.id, id, name);
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const onDeleteAgent = async (id: AgentId) => {
    try {
      await deleteAgent(task.id, id);
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const renderAdHocRow = (run: Agent, index: number) => {
    const kind = resolveAgentKind(
      run.name,
      firstUserTextByAgentId.get(run.id) ?? null,
      agentKindOverride[run.id] ?? null,
    );
    return (
      <AgentRow
        key={run.id}
        run={run}
        kind={kind}
        index={index}
        telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
        aggregate={aggregatesByAgentId.get(run.id) ?? null}
        turns={turnsByAgentId.get(run.id) ?? 0}
        turnsLoading={run.id === selectedAgentId && loading.transcript}
        isSelected={run.id === selectedAgentId}
        isTaskActive={isTaskActive}
        isEditing={editingId === run.id}
        onClick={() => onPickAgent(run.id)}
        onRenameStart={() => setEditingId(run.id)}
        onRenameCommit={(name) => void onRenameCommit(run.id, name)}
        onRenameCancel={() => setEditingId(null)}
        onDelete={() => void onDeleteAgent(run.id)}
      />
    );
  };

  const hasAnyWorkflow = attachedWorkflows.length > 0;
  const renderWorkflowBlock = (workflow: Workflow, idx: number) => {
    const wfAgents = agentsByWorkflowId.get(workflow.id) ?? EMPTY_ARRAY;
    const actionableStepId = actionableStepIdByWorkflowId.get(workflow.id) ?? null;
    const wfBlocked = blockedByWorkflowId.get(workflow.id) ?? false;
    const canMoveUp = idx > 0;
    const canMoveDown = idx < attachedWorkflows.length - 1;
    return (
      <div key={workflow.id} className={cn('flex flex-col', idx > 0 && 'mt-4')}>
        <header className="flex items-center gap-2 pb-1.5">
          <span className={SECTION_LABEL}>
            <Layers size={11} aria-hidden className="text-primary" />
            Workflow
          </span>
          <span className="flex-1" />
          <WorkflowKindLabel workflow={workflow} />
          {attachedWorkflows.length > 1 ? (
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={() => void onReorderWorkflow(workflow.id, 'up')}
                title="move workflow up"
                aria-label="move workflow up"
                className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp size={11} aria-hidden />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={() => void onReorderWorkflow(workflow.id, 'down')}
                title="move workflow down"
                aria-label="move workflow down"
                className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown size={11} aria-hidden />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void onDetachWorkflow(workflow.id)}
            title="detach workflow"
            aria-label="detach workflow"
            className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <X size={11} aria-hidden />
          </button>
          {idx === 0 ? <AutoRunToggle session={task} /> : null}
        </header>
        {wfAgents.length > 0 ? (
          <div className="flex flex-col gap-1 pl-2">
            {wfAgents.map((run, index) => {
              const isActionable = run.stepId === actionableStepId && run.status === 'pending';
              const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
              const resolvedModel =
                agentModelOverride[run.id] ?? run.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
              return (
                <WorkflowStepRow
                  key={run.id}
                  run={run}
                  kind={kind}
                  index={index}
                  resolvedModel={resolvedModel}
                  isActionable={isActionable}
                  isBlocked={isActionable && wfBlocked}
                  isSelected={run.id === selectedAgentId}
                  isEditing={editingId === run.id}
                  telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
                  aggregate={aggregatesByAgentId.get(run.id) ?? null}
                  turns={turnsByAgentId.get(run.id) ?? 0}
                  turnsLoading={run.id === selectedAgentId && loading.transcript}
                  onStart={() => void onSpawn(run.stepId!, undefined)}
                  onSelect={() => onPickAgent(run.id)}
                  onRenameStart={() => setEditingId(run.id)}
                  onRenameCommit={(name) => void onRenameCommit(run.id, name)}
                  onRenameCancel={() => setEditingId(null)}
                />
              );
            })}
          </div>
        ) : (
          <p className="pl-2 text-2xs text-muted-foreground/60">no agents yet for this workflow.</p>
        )}
      </div>
    );
  };

  return (
    <section className="mt-2 flex flex-col px-3 pb-3">
      {!hasAnyWorkflow ? (
        <div className="flex flex-col gap-1.5">
          <header className="flex items-center justify-between gap-2 pb-1.5">
            <span className={SECTION_LABEL}>
              <Layers size={11} aria-hidden className="text-primary" />
              Workflow
            </span>
          </header>
          <button
            type="button"
            onClick={() => setStartWorkflowOpen(true)}
            className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
          >
            <Plus size={13} aria-hidden />
            Start a workflow
          </button>
        </div>
      ) : (
        <>
          {attachedWorkflows.map(renderWorkflowBlock)}
          <button
            type="button"
            onClick={() => setStartWorkflowOpen(true)}
            className="mt-2 flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
          >
            <Plus size={11} aria-hidden />
            Attach another workflow
          </button>
        </>
      )}

      <header className="mt-6 flex items-center gap-2 pb-1.5">
        <span className={SECTION_LABEL}>
          <DogMascot size={14} className="shrink-0 text-success" />
          Agents
        </span>
      </header>
      {hasAnyWorkflow ? (
        adHocAgents.length > 0 ? (
          <ul className="flex flex-col gap-1 pl-2">{adHocAgents.map(renderAdHocRow)}</ul>
        ) : null
      ) : sorted.length === 0 ? (
        loading.agents ? (
          <ul role="status" aria-label="loading agents" className="flex flex-col gap-1 pl-2">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-center gap-2 rounded px-2 py-1.5">
                <span className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-2 text-xs text-muted-foreground/70">
            No agents yet. Spawn one below.
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-1 pl-2">{sorted.map(renderAdHocRow)}</ul>
      )}
      <div className="flex flex-col gap-1 pl-2">
        <PlanReadySuggestion task={task} />
        <SpawnAgentControl sessionId={task.id} />
      </div>
      {spawnError ? <p className="mt-1 px-2 text-2xs text-danger">{spawnError}</p> : null}
      <StartWorkflowDialog
        open={startWorkflowOpen}
        onClose={() => setStartWorkflowOpen(false)}
        session={task}
      />
    </section>
  );
}

interface SpawnAgentControlProps {
  sessionId: SessionId;
}

interface PopoverAnchor {
  readonly left: number;
  readonly top: number | null;
  readonly bottom: number | null;
  readonly direction: 'up' | 'down';
}

function SpawnAgentControl({ sessionId }: SpawnAgentControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);

  const computeAnchor = useCallback((): PopoverAnchor | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const direction: 'up' | 'down' = spaceBelow > spaceAbove ? 'down' : 'up';
    const left = rect.right + 4;
    if (direction === 'down') {
      return { left, top: rect.top, bottom: null, direction };
    }
    return { left, top: null, bottom: window.innerHeight - rect.bottom, direction };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReanchor = () => {
      const next = computeAnchor();
      if (next) setAnchor(next);
      else setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onReanchor);
    window.addEventListener('scroll', onReanchor, true);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onReanchor);
      window.removeEventListener('scroll', onReanchor, true);
    };
  }, [open, computeAnchor]);

  const onToggle = () => {
    if (!open) {
      const next = computeAnchor();
      if (next) setAnchor(next);
    }
    setOpen((v) => !v);
  };

  const menu =
    open && anchor
      ? createPortal(
          <Popover
            innerRef={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              left: anchor.left,
              ...(anchor.top !== null ? { top: anchor.top } : {}),
              ...(anchor.bottom !== null ? { bottom: anchor.bottom } : {}),
            }}
            className="z-50 w-80 max-h-72 overflow-y-auto py-1"
          >
            <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted-foreground/70">
              by role
            </div>
            {[...AGENT_KIND_ORDER]
              .filter((kind) => AGENT_KIND_DEFAULTS[kind].visible !== false)
              .sort((a, b) => AGENT_KIND_META[a].label.localeCompare(AGENT_KIND_META[b].label))
              .map((kind) => {
                const meta = AGENT_KIND_META[kind];
                const palette = AGENT_KIND_PALETTE[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      void spawnAgent(sessionId, { kindOverride: kind });
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className={cn('size-2 shrink-0 rounded-full', palette.bg)} aria-hidden />
                    <span className="font-medium text-foreground">{meta.label}</span>
                    <span className="truncate text-2xs text-muted-foreground">{meta.hint}</span>
                  </button>
                );
              })}
          </Popover>,
          document.body,
        )
      : null;

  return (
    <div className="relative mt-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={13} aria-hidden />
        Create agent
      </button>
      {menu}
    </div>
  );
}

interface WorkflowStepRowProps {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly resolvedModel: string;
  readonly isActionable: boolean;
  readonly isBlocked: boolean;
  readonly isSelected: boolean;
  readonly isEditing: boolean;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly onStart: () => void;
  readonly onSelect: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
}

function WorkflowStepRow({
  run,
  kind,
  index,
  resolvedModel,
  isActionable,
  isBlocked,
  isSelected,
  isEditing,
  telemetry,
  aggregate,
  turns,
  turnsLoading,
  onStart,
  onSelect,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
}: WorkflowStepRowProps) {
  const isPendingFuture = run.status === 'pending' && !isActionable;
  const modelLabel = resolvedModel.split('-').slice(1, 3).join('-');
  const isStartable = isActionable && !isBlocked;

  const [draft, setDraft] = useState(run.name);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  useEffect(() => {
    if (isEditing) setDraft(run.name);
  }, [isEditing, run.name]);
  useEffect(() => {
    if (!isBlocked) setPendingConfirm(false);
  }, [isBlocked]);

  const handleRowClick = () => {
    if (isPendingFuture) return;
    if (isStartable) {
      onStart();
    } else if (isActionable && isBlocked) {
      setPendingConfirm(true);
    } else {
      onSelect();
    }
  };

  const ROW_BASE =
    'group flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-0 rounded border px-2.5 py-1.5 text-xs font-medium';
  // Border telegraphs the live state. running wins over everything else
  // (the conic-info sweep is the most attention-grabbing); the blocked
  // step pulses warning to say "I'm waiting on you"; otherwise the
  // base tone wins.
  const isRunning = run.status === 'running';
  const containerClass = isRunning
    ? cn(
        `${ROW_BASE} border-info/60 transition-colors cursor-pointer`,
        isSelected ? 'bg-elevated text-foreground' : 'bg-muted/40 text-foreground/80',
      )
    : isStartable
      ? `${ROW_BASE} border-primary/40 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/20 cursor-pointer`
      : isActionable && isBlocked
        ? `${ROW_BASE} border-warning/70 bg-warning/10 text-foreground transition-colors hover:bg-warning/15 cursor-pointer`
        : isPendingFuture
          ? `${ROW_BASE} border-transparent text-muted-foreground/40`
          : cn(
              `${ROW_BASE} transition-colors cursor-pointer`,
              isSelected
                ? 'border-border bg-elevated text-foreground'
                : 'border-border-soft/50 bg-muted/40 text-foreground/80 hover:border-border hover:bg-muted/60',
            );

  const renderStatusIcon = () => {
    if (isStartable) {
      return (
        <span className="relative inline-flex size-3.5">
          <span
            className="absolute inset-0 animate-ping rounded-full bg-primary/30 opacity-75"
            aria-hidden
          />
          <span className="relative flex size-3.5 items-center justify-center rounded-full bg-primary/15">
            <Play size={9} className="text-primary" aria-hidden fill="currentColor" />
          </span>
        </span>
      );
    }
    if (isActionable && isBlocked) {
      return <AlertTriangle size={12} className="text-warning" aria-hidden />;
    }
    if (run.status === 'running') {
      // Used to rely on the row's conic spin-border to signal running.
      // That ring forced a 250×36px composite layer per running agent and
      // showed up in WKWebView profiles as 200ms+ composite stalls on hover.
      // Static border-info now carries the state; a tiny Loader2 spin keeps
      // the motion cue without the gradient cost.
      return <Loader2 size={11} className="animate-spin text-info" aria-hidden />;
    }
    if (run.status === 'completed') {
      return (
        <span className="flex size-3.5 items-center justify-center rounded-full bg-success/15">
          <Check size={9} className="text-success" aria-hidden />
        </span>
      );
    }
    if (run.status === 'failed') {
      return <span className="size-1.5 rounded-full bg-danger" aria-hidden />;
    }
    return <Clock size={11} className="text-muted-foreground/70" aria-hidden />;
  };

  const renderActionIndicator = () => {
    if (run.status === 'running') return null;
    if (isActionable && isBlocked) {
      return <ArrowRight size={13} aria-hidden className="text-warning" />;
    }
    return null;
  };

  const stableTitle =
    isActionable && isBlocked
      ? 'next workflow step. gated by open questions / summarizer (click to force)'
      : isPendingFuture
        ? 'waiting for previous steps'
        : `agent ${run.ordinal + 1}: ${run.status}`;

  return (
    <div className="flex flex-col gap-1">
      <div
        role={isPendingFuture ? undefined : 'button'}
        tabIndex={isEditing || isPendingFuture ? -1 : 0}
        aria-pressed={isPendingFuture ? undefined : isSelected}
        title={stableTitle}
        onClick={isEditing || isPendingFuture ? undefined : handleRowClick}
        onDoubleClick={isEditing || isPendingFuture ? undefined : onRenameStart}
        onKeyDown={(e) => {
          if (isEditing) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
        className={containerClass}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'w-4 shrink-0 text-right text-2xs tabular-nums',
              isPendingFuture ? 'text-muted-foreground/40' : 'text-muted-foreground/60',
            )}
          >
            {index + 1}.
          </span>
          {renderStatusIcon()}
          <AgentKindChip kind={kind} muted={isPendingFuture} />
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onRenameCommit(draft);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onRenameCancel();
                }
              }}
              onBlur={() => onRenameCommit(draft)}
              className="min-w-0 flex-1 rounded bg-background px-1.5 py-0.5 text-xs font-semibold text-foreground outline-none ring-1 ring-primary"
              aria-label="rename agent"
            />
          ) : (
            <span className="truncate font-semibold">{run.name}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              'text-[10px] font-normal tabular-nums',
              isPendingFuture ? 'text-muted-foreground/60' : 'opacity-60',
            )}
            title={`model: ${resolvedModel}`}
          >
            {modelLabel}
          </span>
          {renderActionIndicator()}
        </span>
        <div
          className={cn(
            'w-full basis-full grid transition-[grid-template-rows] duration-200 ease-out',
            isSelected && !isPendingFuture ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1 pt-1">
              <AgentMetricsBlock
                run={run}
                telemetry={telemetry}
                aggregate={aggregate}
                turns={turns}
                turnsLoading={turnsLoading}
                variant="workflow"
              />
              <ContextWindowBar telemetry={telemetry} aggregate={aggregate} />
            </div>
          </div>
        </div>
      </div>
      {pendingConfirm ? (
        <div className="rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-[11px]">
          <p className="mb-2 font-medium text-foreground">
            open questions need resolution before starting this step.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingConfirm(false);
              }}
              className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground hover:opacity-90"
            >
              resolve first
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingConfirm(false);
                onStart();
              }}
              className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
            >
              force spawn
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface AgentRowProps {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isEditing: boolean;
  readonly onClick: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
  readonly onDelete: () => void;
}

function AgentRow({
  run,
  kind,
  index,
  telemetry,
  aggregate,
  turns,
  turnsLoading,
  isSelected,
  isTaskActive,
  isEditing,
  onClick,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: AgentRowProps) {
  const total = telemetry ? telemetry.inputTokens + telemetry.outputTokens : null;
  const titleParts = [
    `agent ${run.ordinal + 1}`,
    `status: ${run.status}`,
    isSelected ? 'selected: chat shows this agent' : 'click to switch chat to this agent',
    telemetry ? `provider: ${telemetry.provider}` : null,
    telemetry ? `model: ${telemetry.model}` : null,
    total !== null
      ? `last turn: ${total} tokens · ${formatCost(telemetry!.estimatedCostUsd)}`
      : null,
  ].filter((p): p is string => p !== null);

  const [draft, setDraft] = useState(run.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (isEditing) setDraft(run.name);
  }, [isEditing, run.name]);
  useEffect(() => {
    if (isEditing) setConfirmingDelete(false);
  }, [isEditing]);

  return (
    <li
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? -1 : 0}
      aria-pressed={isEditing ? undefined : isSelected}
      onClick={isEditing ? undefined : onClick}
      onDoubleClick={isEditing ? undefined : onRenameStart}
      onKeyDown={(e) => {
        if (isEditing) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group rounded border transition-colors',
        isEditing ? '' : 'cursor-pointer',
        isSelected ? 'bg-elevated' : 'bg-muted/40 hover:bg-muted/60',
        // State signal lives on the border, never on the dot, never on
        // the content. running > unread > selected > idle. Static colors
        // only; the prior `spin-border` and `animate-border-pulse` here
        // were the same GPU-heavy conic-gradient / oklch border-color
        // animations dropped from the workflow row variant.
        run.status === 'running'
          ? 'border-info/60'
          : agentHasUnread(run, isSelected && isTaskActive)
            ? 'border-warning/70'
            : isSelected
              ? 'border-border'
              : 'border-transparent',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5" title={titleParts.join('\n')}>
        <span
          aria-hidden
          className="w-4 shrink-0 text-right text-2xs tabular-nums text-muted-foreground/60"
        >
          {index + 1}.
        </span>
        <AgentKindChip
          kind={kind}
          title={`agent ${run.ordinal + 1}: ${AGENT_KIND_PALETTE[kind].label}`}
        />
        {isEditing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                onRenameCommit(draft);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onRenameCancel();
              }
            }}
            onBlur={() => onRenameCommit(draft)}
            className="line-clamp-1 flex-1 rounded-full bg-background px-1.5 py-0.5 text-2xs font-medium text-foreground outline-none ring-1 ring-primary"
            aria-label="rename agent"
          />
        ) : (
          <span
            className={cn(
              'line-clamp-1 flex-1 text-left text-2xs font-medium',
              isSelected ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {run.name}
          </span>
        )}
        {!isEditing ? (
          confirmingDelete ? (
            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded px-1 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete();
                }}
                className="rounded px-1 py-0.5 text-2xs font-medium text-danger transition-colors hover:bg-danger/10"
                title="confirm delete"
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-2xs text-muted-foreground/70 group-hover:hidden">
                <AgentLifetime run={run} />
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
                className="hidden rounded p-0.5 text-muted-foreground/60 transition-colors group-hover:inline-flex hover:text-danger"
                title="delete agent (double-click row to rename)"
                aria-label="delete agent"
              >
                <Trash2 size={11} aria-hidden />
              </button>
            </div>
          )
        ) : null}
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isSelected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 px-2 pb-1.5">
            <AgentMetricsBlock
              run={run}
              telemetry={telemetry}
              aggregate={aggregate}
              turns={turns}
              turnsLoading={turnsLoading}
              variant="adhoc"
            />
            <ContextWindowBar telemetry={telemetry} aggregate={aggregate} />
          </div>
        </div>
      </div>
    </li>
  );
}

function findContextWindow(model: string): number | null {
  for (const cap of Object.values(PROVIDER_CAPABILITIES)) {
    const m = cap.models.find((mm) => mm.id === model);
    if (m) return m.contextWindow;
  }
  return null;
}

function AgentLifetime({ run }: { run: Agent }) {
  const isLive = !!run.startedAt && !run.completedAt;
  // Subscribe to a shared 5s ticker so the relative label refreshes without
  // spawning one setInterval per live agent. The hook no-ops when isLive is
  // false, completed agents render once and never re-tick.
  const now = useNow(5_000, isLive);
  void now;

  if (!run.startedAt) {
    return (
      <span
        className="font-mono text-muted-foreground/60"
        title="agent spawned but has not run yet"
      >
        0
      </span>
    );
  }

  const ageStr = formatRelativeDuration(run.startedAt, run.completedAt);
  const tooltip = run.completedAt
    ? `started ${run.startedAt}\ncompleted ${run.completedAt}\nworked ${ageStr}`
    : `started ${run.startedAt}\nworking for ${ageStr}`;

  return (
    <span className="font-mono text-muted-foreground/80" title={tooltip}>
      {ageStr}
    </span>
  );
}

function ContextWindowBar({
  telemetry,
  aggregate,
}: {
  telemetry: TelemetryRecord | null;
  aggregate: AgentAggregate | null;
}) {
  if (!telemetry) return null;
  const window = findContextWindow(telemetry.model);
  if (!window) return null;
  // Conversation size proxy: sum of per-turn uncached input deltas + assistant
  // output across the session. Each turn's `inputTokens` is the *new* tokens
  // added (the cached prefix isn't double-counted), and each `outputTokens`
  // becomes part of history for the next turn. Avoids the `cache_read` trap:
  // claude-code's per-turn `cache_read_input_tokens` sums every sub-call in a
  // tool loop, so adding it would multiply by the number of iterations.
  const cumulativeInput = aggregate?.inputTokens ?? telemetry.inputTokens;
  const cumulativeOutput = aggregate?.outputTokens ?? telemetry.outputTokens;
  const used = cumulativeInput + cumulativeOutput;
  const pct = Math.min(1, used / window);
  const barTone = (() => {
    if (pct >= 0.9) return 'bg-danger';
    if (pct >= 0.75) return 'bg-warning';
    if (pct >= 0.5) return 'bg-info';
    return 'bg-success';
  })();
  const iconTone = (() => {
    if (pct >= 0.9) return 'text-danger';
    if (pct >= 0.75) return 'text-warning';
    if (pct >= 0.5) return 'text-info';
    return 'text-success';
  })();
  const windowLabel = window >= 1_000_000 ? `${window / 1_000_000}M` : `${window / 1_000}k`;
  const tooltip =
    `context: ${used.toLocaleString()} / ${window.toLocaleString()} tokens (${Math.round(pct * 100)}%)\n` +
    `cumulative input: ${cumulativeInput.toLocaleString()} · output: ${cumulativeOutput.toLocaleString()}`;
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground/60">
        <span className={cn('flex items-center gap-0.5', iconTone)}>
          <Gauge size={9} aria-hidden />
          ctx
        </span>
        <span className="font-mono">
          {formatTokens(used)} / {windowLabel} · {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full transition-all', barTone)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
