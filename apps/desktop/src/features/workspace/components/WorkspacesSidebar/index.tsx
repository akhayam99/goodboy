import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createPortal } from 'react-dom';
import {
  Button,
  Dialog,
  Divider,
  EmptyState,
  Popover,
  ScrollArea,
  SectionHeader,
  cn,
} from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  DollarSign,
  FolderPlus,
  Gauge,
  GitCommit,
  GitPullRequest,
  HelpCircle,
  Layers,
  Loader2,
  MessageSquareReply,
  Moon,
  MousePointerClick,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plug,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { SessionSettingsDialog } from '../../../session/components/SessionSettingsDialog';
import { GuideDialog } from '../../../settings/components/GuideDialog';
import { NotificationCenter } from '../../../../features/notifications/components/NotificationCenter';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../updater/components/UpdateIndicator';
import { OnboardingChip } from '../../../onboarding/OnboardingCard';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  TelemetryRecord,
  TurnState,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
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
import {
  workflowHasOpenQuestions,
  workflowRunHasOpenQuestions,
} from '../../../../features/context/openQuestionsGate';
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
  kindConsumesPlan,
  resolveAgentKind,
} from '../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../features/session/components/AgentKindChip';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../features/session/components/AgentMetricsBlock';
import { formatError } from '../../../../shared/lib/errors';
import { useThemeStore } from '../../../../shared/lib/theme';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { WorkspaceLinkDialog } from '../WorkspaceLinkDialog';
import { SessionActivityBar } from '../SessionActivityBar';
import { SessionDetailPanel, SessionMetaFooter } from '../SessionDetailPanel';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { useNow } from '../../../../shared/hooks/useNow';
import { openUrl } from '../../../../shared/lib/editor';

type WorkspacesSidebarProps = {
  onOpenSettings: () => void;
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenProviders: () => void;
  onOpenGithub: () => void;
  onOpenBudget: () => void;
  collapsed?: boolean;
  onToggleCollapse: () => void;
};

const FOOTER_ICON_BTN =
  'flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50' as const;

export const WorkspacesSidebar = ({
  onOpenSettings,
  onOpenPalette,
  onOpenWorkflows,
  onOpenLinear,
  onOpenProviders,
  onOpenGithub,
  onOpenBudget,
  collapsed = false,
  onToggleCollapse,
}: WorkspacesSidebarProps) => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
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

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

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
    if (!currentWorkspace) {
      return;
    }
    void loadArchivedSessions(currentWorkspace.id);
  }, [currentWorkspace, loadArchivedSessions]);
  const isCurrentArchived = !!currentSession?.archivedAt;

  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (!collapsed && currentWorkspace) {
        setNewSessionOpen(true);
      }
    };
    window.addEventListener('goodboy:new-session', handler);
    return () => window.removeEventListener('goodboy:new-session', handler);
  }, [collapsed, currentWorkspace]);

  if (collapsed) {
    return <CollapsedSidebarRail onExpand={onToggleCollapse} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <WorkspaceHeader />
      </div>

      <Divider />

      <div className="flex min-h-0 flex-1">
        {currentWorkspace ? (
          (() => {
            const totalSessions = activeSessions.length + archivedSessions.length;
            const hasAnySession = totalSessions > 0;
            return (
              <div className="mx-3 my-3 flex min-h-0 flex-1 overflow-hidden">
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
                <Divider orientation="vertical" className="mx-1.5" />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {currentSession ? (
                    <>
                      <SessionDetailPanel
                        session={currentSession}
                        onOpenSessionSettings={() => setSessionSettingsOpen(true)}
                      />
                      <Divider />
                      <ScrollArea className="min-h-0 flex-1">
                        <AgentsSection task={currentSession} />
                      </ScrollArea>
                      <SessionMetaFooter session={currentSession} />
                    </>
                  ) : (
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

      {currentWorkspace ? (
        <QuickActionsRow
          onOpenPalette={onOpenPalette}
          onOpenWorkflows={onOpenWorkflows}
          onOpenLinear={onOpenLinear}
          onOpenProviders={onOpenProviders}
          onOpenGithub={onOpenGithub}
          linearEnabled={hasLinear}
          skillsEnabled={WORKSPACE_FEATURES.skills}
        />
      ) : null}

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
            onClick={onOpenBudget}
            title="open budget studio"
            aria-label="open budget studio"
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

      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
      {guideOpen ? <GuideDialog open onClose={() => setGuideOpen(false)} /> : null}
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
};

function CollapsedSidebarRail({ onExpand }: { onExpand: () => void }) {
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
  onOpenProviders,
  onOpenGithub,
  linearEnabled,
  skillsEnabled,
}: {
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenProviders: () => void;
  onOpenGithub: () => void;
  linearEnabled: boolean;
  skillsEnabled: boolean;
}) {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );
  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 pt-2">
      {skillsEnabled ? (
        <QuickAction
          icon={<Sparkles size={12} className="text-warning" aria-hidden />}
          label="Skills"
          onClick={() => onOpenPalette('/')}
        />
      ) : null}

      <QuickAction
        icon={<Layers size={12} className="text-primary" aria-hidden />}
        label="Workflows"
        onClick={onOpenWorkflows}
      />
      <QuickAction
        icon={<Plug size={12} className="text-info" aria-hidden />}
        label="Providers"
        title="connect and manage your provider accounts"
        onClick={onOpenProviders}
        pulse={noProviderConnected}
      />
      {linearEnabled ? (
        <QuickAction
          icon={
            <span className="flex size-3 items-center justify-center rounded-[3px] bg-provider-linear text-[7px] font-bold text-white">
              L
            </span>
          }
          label="Linear"
          title="launch a session from a Linear issue"
          onClick={onOpenLinear}
        />
      ) : null}
      <QuickAction
        icon={<GitPullRequest size={12} className="text-merged" aria-hidden />}
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
  pulse,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  pulse?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `browse ${label.toLowerCase()} in the command palette`}
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-1.5 py-1.5 text-2xs font-medium transition-colors',
        pulse
          ? 'animate-soft-pulse border-info/55 bg-info/5 text-foreground hover:bg-info/10'
          : 'border-border-soft bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function workflowKindName(workflow: Workflow): string {
  const needle = workflow.name.trim().toLowerCase();
  if (!needle) {
    return 'custom';
  }
  const match = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === needle);
  return match?.name.toLowerCase() ?? 'custom';
}

function WorkflowKillButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm">
        <span className="px-0.5 text-2xs text-muted-foreground">Discard?</span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          title="confirm discard"
          aria-label="confirm discard workflow"
          className="rounded p-0.5 text-danger transition-colors hover:bg-danger/10"
        >
          <Check size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          title="cancel"
          aria-label="cancel discard workflow"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="discard workflow"
      aria-label="discard workflow"
      className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <Ban size={11} aria-hidden />
    </button>
  );
}

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
  if (!latest || latest.status !== 'active') {
    return null;
  }

  const creator = phaseRuns.find((r) => r.id === latest.agentId);
  const creatorWorkflow = creator?.stepId
    ? (phaseTemplates.find((t) => t.steps.some((s) => s.id === creator.stepId)) ?? null)
    : null;
  if (creatorWorkflow) {
    if (workflowHasOpenQuestions(openQuestions, creatorWorkflow.id)) {
      return null;
    }
  } else if (openQuestions.some((q) => q.status === 'open')) {
    return null;
  }

  const liveStepIds = new Set<StepId>();
  for (const run of task.workflowRuns) {
    if (run.discardedAt) {
      continue;
    }
    phaseTemplates
      .find((t) => t.id === run.workflowId)
      ?.steps.forEach((s) => liveStepIds.add(s.id));
  }
  const hasPendingConsumer = phaseRuns.some(
    (a) =>
      a.status === 'pending' &&
      a.stepId !== undefined &&
      liveStepIds.has(a.stepId) &&
      kindConsumesPlan((a.kind as AgentKind | undefined) ?? inferAgentKindFromName(a.name)),
  );
  if (hasPendingConsumer) {
    return null;
  }

  const onSpawn = async () => {
    if (spawning) {
      return;
    }
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
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={hasAnySession ? MousePointerClick : Sparkles}
        title={hasAnySession ? 'No session selected' : 'No sessions yet'}
        description={
          hasAnySession
            ? 'Pick a session from the list to the left.'
            : 'Create your first session from the list to the left.'
        }
      />
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
          Point at a local git repo. Each session opens its own worktree off it.
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

type AgentsSectionProps = {
  task: Session;
};

function AgentsSection({ task }: AgentsSectionProps) {
  const isTaskActive = useAppStore((s) => s.currentSessionId === task.id);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const messages = useAppStore((s) => s.messages[task.id] ?? EMPTY_ARRAY);
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReadonlyArray<ProviderRunId>> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const history = s.agentRunHistory[run.id];
        if (history) {
          out[run.id] = history;
        }
      }
      return out;
    }),
  );
  const agentKindOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, AgentKind> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const kind = s.agentKindOverride[run.id];
        if (kind) {
          out[run.id] = kind;
        }
      }
      return out;
    }),
  );
  const agentModelOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, string> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const model = s.agentModelOverride[run.id];
        if (model) {
          out[run.id] = model;
        }
      }
      return out;
    }),
  );
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const prNumber = useAppStore((s) => s.sessionGithub[task.id]?.pr?.number ?? null);
  const resolvedThreadIds = useAppStore(
    useShallow(
      (s) =>
        new Set(
          (s.sessionGithub[task.id]?.detail?.comments ?? [])
            .filter((c) => c.resolved === true && c.threadId != null)
            .map((c) => c.threadId as string),
        ),
    ),
  );
  const pendingThreadIds = useAppStore(
    useShallow((s) => new Set((s.sessionPendingResolutions[task.id] ?? []).map((r) => r.threadId))),
  );
  const resolverState = useAppStore(
    useShallow((s) => {
      const out: Record<string, 'awaiting' | 'committed' | 'wontfix'> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const st = s.resolverState[run.id];
        if (st) {
          out[run.id] = st;
        }
      }
      return out;
    }),
  );
  const selectAgent = useAppStore((s) => s.selectAgent);
  const activateNextResolver = useAppStore((s) => s.activateNextResolver);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const deleteAgent = useAppStore((s) => s.deleteAgent);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionWorkflows = useAppStore(
    (s) => s.sessionWorkflows[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const attachedRuns = useMemo<ReadonlyArray<{ run: WorkflowRun; workflow: Workflow }>>(() => {
    const byId = new Map<string, Workflow>();
    for (const w of phaseTemplates) byId.set(w.id, w);
    for (const w of sessionWorkflows) byId.set(w.id, w);
    return [...task.workflowRuns]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((run) => {
        const workflow = byId.get(run.workflowId);
        return workflow ? { run, workflow } : null;
      })
      .filter((e): e is { run: WorkflowRun; workflow: Workflow } => e !== null);
  }, [task.workflowRuns, phaseTemplates, sessionWorkflows]);
  const discardWorkflow = useAppStore((s) => s.discardWorkflow);
  const reorderSessionWorkflows = useAppStore((s) => s.reorderSessionWorkflows);
  const setWorkflowRunAutoRun = useAppStore((s) => s.setWorkflowRunAutoRun);
  const openQuestions = useSessionOpenQuestions(task.id);
  const loading = useSessionLoading(task.id);
  const summarizerBusy = useAppStore((s) => s.summarizerStatus[task.id]?.status === 'running');
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [startWorkflowOpen, setStartWorkflowOpen] = useState(false);
  const [editingId, setEditingId] = useState<AgentId | null>(null);
  const [workflowExpand, setWorkflowExpand] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleWorkflowExpand = useCallback((id: string, isDiscarded: boolean) => {
    setWorkflowExpand((prev) => {
      const next = new Map(prev);
      next.set(id, !(prev.get(id) ?? !isDiscarded));
      return next;
    });
  }, []);
  const [resolveExpanded, setResolveExpanded] = useState(true);
  const [clusterExpand, setClusterExpand] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleClusterExpand = useCallback((id: string) => {
    setClusterExpand((prev) => {
      const next = new Map(prev);
      next.set(id, !(prev.get(id) ?? false));
      return next;
    });
  }, []);

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
  const agentsByRunId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const r of sorted) {
      if (r.stepId == null || r.workflowRunId == null) {
        continue;
      }
      const bucket = map.get(r.workflowRunId) ?? [];
      bucket.push(r);
      map.set(r.workflowRunId, bucket);
    }
    return map;
  }, [sorted]);
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const r of sorted) {
      if (r.parentAgentId == null) {
        continue;
      }
      const bucket = map.get(r.parentAgentId) ?? [];
      bucket.push(r);
      map.set(r.parentAgentId, bucket);
    }
    return map;
  }, [sorted]);
  const adHocAgents = useMemo(
    () =>
      sorted.filter(
        (r) => r.parentAgentId == null && !(r.workflowRunId != null && r.stepId != null),
      ),
    [sorted],
  );
  const actionableStepIdByRunId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const { run, workflow } of attachedRuns) {
      if (run.discardedAt) {
        map.set(run.id, null);
        continue;
      }
      const runAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
      map.set(run.id, pickNextWorkflowStep(workflow, runAgents)?.id ?? null);
    }
    return map;
  }, [attachedRuns, agentsByRunId]);
  const blockReasonByRunId = useMemo(() => {
    const map = new Map<string, WorkflowBlockReason | null>();
    for (const { run } of attachedRuns) {
      const reason = workflowRunHasOpenQuestions(openQuestions, run.id)
        ? 'questions'
        : summarizerBusy
          ? 'summarizer'
          : null;
      map.set(run.id, reason);
    }
    return map;
  }, [attachedRuns, openQuestions, summarizerBusy]);

  const onDiscardWorkflow = useCallback(
    async (runId: WorkflowRunId) => {
      try {
        await discardWorkflow(task.id, runId);
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [discardWorkflow, task.id],
  );

  const onReorderWorkflow = useCallback(
    async (runId: WorkflowRunId, direction: 'up' | 'down') => {
      const ids = [...task.workflowRuns].sort((a, b) => a.ordinal - b.ordinal).map((r) => r.id);
      const idx = ids.indexOf(runId);
      if (idx === -1) {
        return;
      }
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= ids.length) {
        return;
      }
      [ids[idx], ids[swap]] = [ids[swap]!, ids[idx]!];
      try {
        await reorderSessionWorkflows(task.id, ids);
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [reorderSessionWorkflows, task.id, task.workflowRuns],
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
      if (m.role !== 'user') {
        continue;
      }
      map.set(m.agentId, (map.get(m.agentId) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  const firstUserTextByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.role !== 'user') {
        continue;
      }
      if (map.has(m.agentId)) {
        continue;
      }
      map.set(m.agentId, m.content);
    }
    return map;
  }, [messages]);

  const resolverAgents = useMemo(
    () =>
      sorted.filter(
        (r) =>
          r.parentAgentId == null &&
          r.stepId == null &&
          resolveAgentKind(
            r.name,
            firstUserTextByAgentId.get(r.id) ?? null,
            agentKindOverride[r.id] ?? null,
          ) === 'resolver',
      ),
    [sorted, firstUserTextByAgentId, agentKindOverride],
  );
  const resolverIds = useMemo(() => new Set(resolverAgents.map((r) => r.id)), [resolverAgents]);

  const aggregatesByAgentId = useMemo(() => {
    const map = new Map<
      string,
      { inputTokens: number; outputTokens: number; estimatedCostUsd: number; turns: number }
    >();
    const telemetryByRun = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      if (rec.kind !== 'turn') {
        continue;
      }
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
        if (!rec) {
          continue;
        }
        inputTokens += rec.inputTokens;
        outputTokens += rec.outputTokens;
        estimatedCostUsd += rec.estimatedCostUsd;
        turns += 1;
      }
      map.set(run.id, { inputTokens, outputTokens, estimatedCostUsd, turns });
    }
    const childIds = new Map<string, string[]>();
    for (const run of phaseRuns) {
      if (run.parentAgentId == null) {
        continue;
      }
      const bucket = childIds.get(run.parentAgentId) ?? [];
      bucket.push(run.id);
      childIds.set(run.parentAgentId, bucket);
    }
    const rolled = new Set<string>();
    const rollup = (id: string) => {
      if (rolled.has(id)) {
        return;
      }
      rolled.add(id);
      const self = map.get(id);
      if (!self) {
        return;
      }
      for (const cid of childIds.get(id) ?? []) {
        rollup(cid);
        const child = map.get(cid);
        if (!child) {
          continue;
        }
        self.inputTokens += child.inputTokens;
        self.outputTokens += child.outputTokens;
        self.estimatedCostUsd += child.estimatedCostUsd;
        self.turns += child.turns;
      }
    };
    for (const run of phaseRuns) rollup(run.id);
    return map;
  }, [telemetry, phaseRuns, agentRunHistory]);

  const latestTelemetryByAgentId = useMemo(
    () => computeLatestTelemetryByAgentId(phaseRuns, agentRunHistory, telemetryByRunId),
    [telemetryByRunId, phaseRuns, agentRunHistory],
  );

  const onPickAgent = (sid: AgentId) => {
    if (sid === selectedAgentId) {
      return;
    }
    void selectAgent(task.id, sid);
  };

  const onStartStepAgent = async (agent: Agent, model?: string) => {
    setSpawnError(null);
    try {
      if (agent.status === 'pending') {
        await activateWorkflowAgent(task.id, agent.id);
        return;
      }
      await spawnAgent(task.id, {
        ...(agent.stepId != null && { stepId: agent.stepId }),
        ...(agent.workflowRunId != null && { workflowRunId: agent.workflowRunId }),
        ...(model !== undefined && { model }),
      });
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
    const scoutChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
    return (
      <Fragment key={run.id}>
        <AgentRow
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
        {scoutChildren.length > 0 ? (
          <li>
            <ScoutSubtree
              containerId={run.id}
              depth={0}
              childrenByParentId={childrenByParentId}
              aggregatesByAgentId={aggregatesByAgentId}
              selectedAgentId={selectedAgentId}
              expandState={clusterExpand}
              onToggle={toggleClusterExpand}
              onSelect={onPickAgent}
            />
          </li>
        ) : null}
      </Fragment>
    );
  };

  const hasAnyWorkflow = attachedRuns.length > 0;
  const renderWorkflowRow = (
    { run, workflow }: { run: WorkflowRun; workflow: Workflow },
    idx: number,
  ) => {
    const isDiscarded = run.discardedAt != null;
    const expanded = workflowExpand.get(run.id) ?? !isDiscarded;
    const wfAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
    const actionableStepId = actionableStepIdByRunId.get(run.id) ?? null;
    const wfBlockReason = blockReasonByRunId.get(run.id) ?? null;
    const canMoveUp = idx > 0;
    const canMoveDown = idx < attachedRuns.length - 1;
    const name = workflowKindName(workflow);
    const total = workflow.steps.length;
    const done = wfAgents.filter((a) => a.status === 'completed' || a.status === 'skipped').length;
    const isCompleted = !isDiscarded && total > 0 && done >= total;
    return (
      <div key={run.id} className={cn('flex flex-col', isDiscarded && 'opacity-70')}>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => toggleWorkflowExpand(run.id, isDiscarded)}
            title={workflow.name || name}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'collapse' : 'expand'} ${name} workflow`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-muted/50"
          >
            {expanded ? (
              <ChevronDown size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
            ) : (
              <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
            )}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {name}
            </span>
            {isDiscarded ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Ban size={10} aria-hidden /> discarded
              </span>
            ) : isCompleted ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                <Check size={10} aria-hidden /> completed
              </span>
            ) : total > 0 ? (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
                {done}/{total}
              </span>
            ) : null}
          </button>
          {!isDiscarded && !isCompleted ? (
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
                title={run.autoRun ? 'autorun on, click to pause' : 'autorun off, click to enable'}
                aria-label={run.autoRun ? 'autorun on' : 'autorun off'}
                aria-pressed={run.autoRun}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  run.autoRun
                    ? 'text-danger hover:bg-danger/15'
                    : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
                )}
              >
                {run.autoRun ? <Zap size={11} aria-hidden /> : <ZapOff size={11} aria-hidden />}
              </button>
              {attachedRuns.length > 1 ? (
                <>
                  <button
                    type="button"
                    disabled={!canMoveUp}
                    onClick={() => void onReorderWorkflow(run.id, 'up')}
                    title="move workflow up"
                    aria-label="move workflow up"
                    className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp size={11} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveDown}
                    onClick={() => void onReorderWorkflow(run.id, 'down')}
                    title="move workflow down"
                    aria-label="move workflow down"
                    className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown size={11} aria-hidden />
                  </button>
                </>
              ) : null}
              <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
            </div>
          ) : null}
        </div>
        {expanded ? (
          wfAgents.length > 0 ? (
            <div className="flex flex-col gap-1 pb-1 pl-5">
              {wfAgents.map((run, index) => {
                const isActionable = run.stepId === actionableStepId && run.status === 'pending';
                const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
                const resolvedModel =
                  agentModelOverride[run.id] ??
                  run.modelOverride ??
                  AGENT_KIND_DEFAULTS[kind].model;
                const clusterChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
                const clustersExpanded = clusterExpand.get(run.id) ?? false;
                return (
                  <Fragment key={run.id}>
                    <WorkflowStepRow
                      run={run}
                      kind={kind}
                      index={index}
                      resolvedModel={resolvedModel}
                      isActionable={isActionable}
                      blockReason={isActionable ? wfBlockReason : null}
                      isSelected={run.id === selectedAgentId}
                      isEditing={editingId === run.id}
                      telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
                      aggregate={aggregatesByAgentId.get(run.id) ?? null}
                      turns={turnsByAgentId.get(run.id) ?? 0}
                      turnsLoading={run.id === selectedAgentId && loading.transcript}
                      onStart={() => void onStartStepAgent(run)}
                      onSelect={() => onPickAgent(run.id)}
                      onRenameStart={() => setEditingId(run.id)}
                      onRenameCommit={(name) => void onRenameCommit(run.id, name)}
                      onRenameCancel={() => setEditingId(null)}
                    />
                    {clusterChildren.length === 0 ? null : kind === 'scout' ? (
                      <ScoutSubtree
                        containerId={run.id}
                        depth={0}
                        childrenByParentId={childrenByParentId}
                        aggregatesByAgentId={aggregatesByAgentId}
                        selectedAgentId={selectedAgentId}
                        expandState={clusterExpand}
                        onToggle={toggleClusterExpand}
                        onSelect={onPickAgent}
                      />
                    ) : (
                      <div className="ml-3 flex flex-col gap-0.5 border-l border-border-soft/60 pl-2">
                        <button
                          type="button"
                          onClick={() => toggleClusterExpand(run.id)}
                          aria-expanded={clustersExpanded}
                          aria-label={`${clustersExpanded ? 'collapse' : 'expand'} clusters for ${run.name}`}
                          className="flex items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                        >
                          {clustersExpanded ? (
                            <ChevronDown size={10} aria-hidden className="shrink-0" />
                          ) : (
                            <ChevronRight size={10} aria-hidden className="shrink-0" />
                          )}
                          clusters {clusterChildren.filter((c) => c.status === 'completed').length}/
                          {clusterChildren.length}
                        </button>
                        {clustersExpanded
                          ? clusterChildren.map((child, ci) => (
                              <ClusterChildRow
                                key={child.id}
                                child={child}
                                index={ci}
                                total={clusterChildren.length}
                                costUsd={aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0}
                                isSelected={child.id === selectedAgentId}
                                onSelect={() => onPickAgent(child.id)}
                              />
                            ))
                          : null}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <p className="pb-1 pl-5 text-2xs text-muted-foreground/60">
              no agents yet for this workflow.
            </p>
          )
        ) : null}
      </div>
    );
  };

  return (
    <section className="mt-2 flex flex-col px-3 pb-3">
      <SectionHeader
        className="pb-1.5"
        icon={<Layers size={11} aria-hidden className="text-primary" />}
        label="Workflow"
      />
      {!hasAnyWorkflow ? (
        <button
          type="button"
          onClick={() => setStartWorkflowOpen(true)}
          className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        >
          <Plus size={13} aria-hidden />
          Start a workflow
        </button>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">{attachedRuns.map(renderWorkflowRow)}</div>
          <button
            type="button"
            onClick={() => setStartWorkflowOpen(true)}
            className="mt-1.5 flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
          >
            <Plus size={11} aria-hidden />
            Attach another workflow
          </button>
        </>
      )}

      <SectionHeader
        className="mt-6 pb-1.5"
        icon={<DogMascot size={14} className="shrink-0 text-success" />}
        label="Agents"
      />
      {hasAnyWorkflow ? (
        adHocAgents.some((r) => !resolverIds.has(r.id)) ? (
          <ul className="flex flex-col gap-1 pl-2">
            {adHocAgents.filter((r) => !resolverIds.has(r.id)).map(renderAdHocRow)}
          </ul>
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
        ) : resolverAgents.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground/70">
            No agents yet. Spawn one below.
          </p>
        ) : null
      ) : (
        <ul className="flex flex-col gap-1 pl-2">
          {sorted.filter((r) => !resolverIds.has(r.id)).map(renderAdHocRow)}
        </ul>
      )}
      {resolverAgents.length > 0 ? (
        <ResolveCluster
          agents={resolverAgents}
          sessionId={task.id}
          prNumber={prNumber}
          resolvedThreadIds={resolvedThreadIds}
          pendingThreadIds={pendingThreadIds}
          resolverState={resolverState}
          selectedAgentId={selectedAgentId}
          expanded={resolveExpanded}
          onToggle={() => setResolveExpanded((v) => !v)}
          onSelect={onPickAgent}
          onForceNext={() => void activateNextResolver(task.id)}
        />
      ) : null}
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

type SpawnAgentControlProps = {
  sessionId: SessionId;
};

type PopoverAnchor = {
  readonly left: number;
  readonly top: number | null;
  readonly bottom: number | null;
  readonly direction: 'up' | 'down';
};

function SpawnAgentControl({ sessionId }: SpawnAgentControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);

  const computeAnchor = useCallback((): PopoverAnchor | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
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
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onReanchor = () => {
      const next = computeAnchor();
      if (next) {
        setAnchor(next);
      } else {
        setOpen(false);
      }
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
      if (next) {
        setAnchor(next);
      }
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

type ClusterChildRowProps = {
  readonly child: Agent;
  readonly index: number;
  readonly total: number;
  readonly costUsd: number;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

function ClusterChildRow({
  child,
  index,
  total,
  costUsd,
  isSelected,
  onSelect,
}: ClusterChildRowProps) {
  const icon =
    child.status === 'running' ? (
      <Loader2 size={10} className="animate-spin text-info" aria-hidden />
    ) : child.status === 'completed' ? (
      <span className="flex size-3 items-center justify-center rounded-full bg-success/15">
        <Check size={8} className="text-success" aria-hidden />
      </span>
    ) : child.status === 'failed' ? (
      <span className="size-1.5 rounded-full bg-danger" aria-hidden />
    ) : (
      <Clock size={10} className="text-muted-foreground/60" aria-hidden />
    );
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1 text-2xs font-medium transition-colors',
        isSelected
          ? 'bg-elevated text-foreground'
          : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span className="tabular-nums text-muted-foreground/50">
        {index + 1}/{total}
      </span>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{child.name}</span>
      {costUsd > 0 ? (
        <span
          className="shrink-0 tabular-nums text-muted-foreground/60"
          title={`$${costUsd.toFixed(4)}`}
        >
          ${costUsd.toFixed(2)}
        </span>
      ) : null}
    </button>
  );
}

type ScoutSubtreeProps = {
  readonly containerId: AgentId;
  readonly depth: number;
  readonly childrenByParentId: ReadonlyMap<string, Agent[]>;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
  readonly selectedAgentId: AgentId | null;
  readonly expandState: ReadonlyMap<string, boolean>;
  readonly onToggle: (id: string) => void;
  readonly onSelect: (id: AgentId) => void;
};

function ScoutSubtree({
  containerId,
  depth,
  childrenByParentId,
  aggregatesByAgentId,
  selectedAgentId,
  expandState,
  onToggle,
  onSelect,
}: ScoutSubtreeProps) {
  const children = childrenByParentId.get(containerId) ?? EMPTY_ARRAY;
  if (children.length === 0 || depth > 4) {
    return null;
  }
  const expanded = expandState.get(containerId) ?? false;
  const doneCount = children.filter(
    (c) => c.status === 'completed' || c.status === 'skipped',
  ).length;
  return (
    <div className="ml-3 flex flex-col gap-0.5 border-l border-border-soft/60 pl-2">
      <button
        type="button"
        onClick={() => onToggle(containerId)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'collapse' : 'expand'} scouts`}
        className="flex items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-sky-400/70 transition-colors hover:text-sky-400"
      >
        {expanded ? (
          <ChevronDown size={10} aria-hidden className="shrink-0" />
        ) : (
          <ChevronRight size={10} aria-hidden className="shrink-0" />
        )}
        scouts {doneCount}/{children.length}
      </button>
      {expanded
        ? children.map((child, ci) => (
            <Fragment key={child.id}>
              <ClusterChildRow
                child={child}
                index={ci}
                total={children.length}
                costUsd={aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0}
                isSelected={child.id === selectedAgentId}
                onSelect={() => onSelect(child.id)}
              />
              <ScoutSubtree
                containerId={child.id}
                depth={depth + 1}
                childrenByParentId={childrenByParentId}
                aggregatesByAgentId={aggregatesByAgentId}
                selectedAgentId={selectedAgentId}
                expandState={expandState}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            </Fragment>
          ))
        : null}
    </div>
  );
}

type ResolverState = 'awaiting' | 'committed' | 'wontfix';
type ResolverStatus =
  | 'running'
  | 'failed'
  | 'pending'
  | 'resolved'
  | 'committed'
  | 'wontfix'
  | 'awaiting'
  | 'done';

function resolverStatus(
  agent: Agent,
  resolvedThreadIds: ReadonlySet<string>,
  pendingThreadIds: ReadonlySet<string>,
  state: ResolverState | undefined,
): ResolverStatus {
  if (agent.status === 'running') {
    return 'running';
  }
  if (agent.status === 'failed') {
    return 'failed';
  }
  if (agent.status === 'pending') {
    return 'pending';
  }
  const tid = agent.sourceThreadId;
  if (tid != null && resolvedThreadIds.has(tid)) {
    return 'resolved';
  }
  if (state === 'committed' || (tid != null && pendingThreadIds.has(tid))) {
    return 'committed';
  }
  if (state === 'wontfix') {
    return 'wontfix';
  }
  if (state === 'awaiting') {
    return 'awaiting';
  }
  return 'done';
}

type ResolveClusterProps = {
  readonly agents: ReadonlyArray<Agent>;
  readonly sessionId: SessionId;
  readonly prNumber: number | null;
  readonly resolvedThreadIds: ReadonlySet<string>;
  readonly pendingThreadIds: ReadonlySet<string>;
  readonly resolverState: Readonly<Record<string, ResolverState>>;
  readonly selectedAgentId: AgentId | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onForceNext: () => void;
};

function ResolveCluster({
  agents,
  sessionId,
  prNumber,
  resolvedThreadIds,
  pendingThreadIds,
  resolverState,
  selectedAgentId,
  expanded,
  onToggle,
  onSelect,
  onForceNext,
}: ResolveClusterProps) {
  const statusOf = (a: Agent): ResolverStatus =>
    resolverStatus(a, resolvedThreadIds, pendingThreadIds, resolverState[a.id]);
  const resolvedCount = agents.filter((a) => statusOf(a) === 'resolved').length;
  const anyRunning = agents.some((a) => a.status === 'running');
  const queuedCount = agents.filter((a) => a.status === 'pending').length;
  const stalled = !anyRunning && queuedCount > 0;
  const jump = (agent: Agent) => {
    if (agent.sourceThreadId != null && prNumber != null) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-github-studio', {
          detail: { sessionId, prNumber, threadId: agent.sourceThreadId },
        }),
      );
    } else if (agent.sourceCommentUrl != null) {
      void openUrl(agent.sourceCommentUrl);
    }
  };
  return (
    <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l border-border-soft/60 pl-2">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'collapse' : 'expand'} resolve cluster`}
          className="flex min-w-0 flex-1 items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-lime-500/80 transition-colors hover:text-lime-500"
        >
          {expanded ? (
            <ChevronDown size={10} aria-hidden className="shrink-0" />
          ) : (
            <ChevronRight size={10} aria-hidden className="shrink-0" />
          )}
          resolve {resolvedCount}/{agents.length}
        </button>
        {stalled ? (
          <button
            type="button"
            onClick={onForceNext}
            title="the current resolver has not committed or explained yet; run the next queued one anyway"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning transition-colors hover:bg-warning/20"
          >
            <Play size={9} aria-hidden />
            Run next ({queuedCount})
          </button>
        ) : null}
      </div>
      {expanded
        ? agents.map((agent, i) => (
            <ResolveClusterRow
              key={agent.id}
              agent={agent}
              index={i}
              total={agents.length}
              status={statusOf(agent)}
              isSelected={agent.id === selectedAgentId}
              canJump={agent.sourceThreadId != null || agent.sourceCommentUrl != null}
              onSelect={() => onSelect(agent.id)}
              onJump={() => jump(agent)}
            />
          ))
        : null}
    </div>
  );
}

type ResolveClusterRowProps = {
  readonly agent: Agent;
  readonly index: number;
  readonly total: number;
  readonly status: ResolverStatus;
  readonly isSelected: boolean;
  readonly canJump: boolean;
  readonly onSelect: () => void;
  readonly onJump: () => void;
};

function ResolveClusterRow({
  agent,
  index,
  total,
  status,
  isSelected,
  canJump,
  onSelect,
  onJump,
}: ResolveClusterRowProps) {
  const icon =
    status === 'running' ? (
      <Loader2 size={10} className="animate-spin text-info" aria-hidden />
    ) : status === 'failed' ? (
      <span className="size-1.5 rounded-full bg-danger" aria-hidden />
    ) : status === 'pending' ? (
      <Clock size={10} className="text-muted-foreground/60" aria-hidden />
    ) : status === 'resolved' ? (
      <CheckCheck size={10} className="text-success" aria-hidden />
    ) : status === 'committed' ? (
      <GitCommit size={10} className="text-warning" aria-hidden />
    ) : status === 'wontfix' ? (
      <Ban size={10} className="text-muted-foreground/70" aria-hidden />
    ) : status === 'awaiting' ? (
      <AlertTriangle size={10} className="text-warning" aria-hidden />
    ) : (
      <Check size={10} className="text-muted-foreground/70" aria-hidden />
    );
  const statusLabel =
    status === 'resolved'
      ? 'resolved on GitHub'
      : status === 'committed'
        ? 'committed locally, pending push'
        : status === 'wontfix'
          ? 'explained, pending resolve'
          : status === 'awaiting'
            ? 'needs you: no commit yet'
            : status === 'running'
              ? 'working'
              : status === 'pending'
                ? 'queued'
                : status === 'failed'
                  ? 'failed'
                  : 'done locally';
  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1 text-2xs font-medium transition-colors',
        isSelected ? 'bg-elevated text-foreground' : 'text-foreground/70 hover:bg-muted/60',
      )}
    >
      <span className="tabular-nums text-muted-foreground/50">
        {index + 1}/{total}
      </span>
      <span title={statusLabel}>{icon}</span>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate text-left hover:text-foreground"
      >
        {agent.name}
      </button>
      {canJump ? (
        <button
          type="button"
          onClick={onJump}
          title="go to the review comment"
          aria-label="go to the review comment"
          className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <MessageSquareReply size={11} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

type WorkflowBlockReason = 'questions' | 'summarizer';

type WorkflowStepRowProps = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly resolvedModel: string;
  readonly isActionable: boolean;
  readonly blockReason: WorkflowBlockReason | null;
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
};

function WorkflowStepRow({
  run,
  kind,
  index,
  resolvedModel,
  isActionable,
  blockReason,
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
  const isBlocked = blockReason !== null;
  const isPendingFuture = run.status === 'pending' && !isActionable;
  const modelLabel = resolvedModel.split('-').slice(1, 3).join('-');
  const isStartable = isActionable && !isBlocked;

  const [draft, setDraft] = useState(run.name);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  useEffect(() => {
    if (isEditing) {
      setDraft(run.name);
    }
  }, [isEditing, run.name]);
  useEffect(() => {
    if (!isBlocked) {
      setPendingConfirm(false);
    }
  }, [isBlocked]);

  const handleRowClick = () => {
    if (isPendingFuture) {
      return;
    }
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
    if (run.status === 'running') {
      return null;
    }
    if (isActionable && isBlocked) {
      return <ArrowRight size={13} aria-hidden className="text-warning" />;
    }
    return null;
  };

  const stableTitle =
    isActionable && isBlocked
      ? blockReason === 'summarizer'
        ? 'next workflow step. waiting for the summarizer to finish (click to force)'
        : 'next workflow step. gated by open questions (click to force)'
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
          if (isEditing) {
            return;
          }
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
            {blockReason === 'summarizer'
              ? 'the summarizer is still running.'
              : 'open questions to resolve first.'}
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
              {blockReason === 'summarizer' ? 'wait' : 'resolve first'}
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

type AgentRowProps = {
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
};

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
    if (isEditing) {
      setDraft(run.name);
    }
  }, [isEditing, run.name]);
  useEffect(() => {
    if (isEditing) {
      setConfirmingDelete(false);
    }
  }, [isEditing]);

  return (
    <li
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? -1 : 0}
      aria-pressed={isEditing ? undefined : isSelected}
      onClick={isEditing ? undefined : onClick}
      onDoubleClick={isEditing ? undefined : onRenameStart}
      onKeyDown={(e) => {
        if (isEditing) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group rounded border transition-colors',
        isEditing ? '' : 'cursor-pointer',
        isSelected ? 'bg-elevated' : 'bg-muted/40 hover:bg-muted/60',
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
    if (m) {
      return m.contextWindow;
    }
  }
  return null;
}

function AgentLifetime({ run }: { run: Agent }) {
  const isLive = !!run.startedAt && !run.completedAt;
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
  if (!telemetry) {
    return null;
  }
  const window = findContextWindow(telemetry.model);
  if (!window) {
    return null;
  }
  const cumulativeInput = aggregate?.inputTokens ?? telemetry.inputTokens;
  const cumulativeOutput = aggregate?.outputTokens ?? telemetry.outputTokens;
  const used = cumulativeInput + cumulativeOutput;
  const pct = Math.min(1, used / window);
  const barTone = (() => {
    if (pct >= 0.9) {
      return 'bg-danger';
    }
    if (pct >= 0.75) {
      return 'bg-warning';
    }
    if (pct >= 0.5) {
      return 'bg-info';
    }
    return 'bg-success';
  })();
  const iconTone = (() => {
    if (pct >= 0.9) {
      return 'text-danger';
    }
    if (pct >= 0.75) {
      return 'text-warning';
    }
    if (pct >= 0.5) {
      return 'text-info';
    }
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
