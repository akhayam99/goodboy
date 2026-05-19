import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea, cn } from '@kay-am/ui';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  ClipboardList,
  Clock,
  DollarSign,
  FolderPlus,
  Gauge,
  HelpCircle,
  Layers,
  Loader2,
  MessagesSquare,
  Moon,
  Play,
  Plus,
  Settings,
  Sun,
  Trash2,
  Check,
  Terminal,
} from 'lucide-react';
import { SessionSettingsDialog } from '../../../session/components/SessionSettingsDialog';
import { GuideDialog } from '../../../settings/components/GuideDialog';
import { NotificationCenter } from '../../../../features/notifications/components/NotificationCenter';
import { PricingDialog } from '../../../providers/components/PricingDialog';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { DogMascot } from '../../../../shared/components/DogMascot';
import type {
  Agent,
  AgentId,
  AgentStatus,
  Session,
  SessionId,
  Step,
  TelemetryRecord,
  TurnState,
  Workflow,
  WorkspaceId,
} from '@kay-am/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionLoading,
  useSessionPlans,
  useSessionSlots,
  useSessions,
} from '../../../../store';
import { NewSessionDialog } from '../../../session/components/NewSessionDialog';
import { pickNextWorkflowStep } from '../../../../features/workflow/components/WorkflowNextStepCta';
import {
  computeLatestTelemetryByAgentId,
  formatCost,
  formatTokens,
} from '../../../../features/session/agent-row-format';
import { PROVIDER_CAPABILITIES, WORKFLOW_LIBRARY } from '@kay-am/core';
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
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { WorkspaceSelect } from '../WorkspaceSelect';
import { SessionActivityBar } from '../SessionActivityBar';
import { SessionDetailPanel, SessionFilesTouchedFooter } from '../SessionDetailPanel';
import { GithubDetailsDialog } from '../../../github/components/GithubDetailsDialog';

interface WorkspacesSidebarProps {
  onOpenSettings: () => void;
}

const FOOTER_ICON_BTN =
  'flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50' as const;

const PREVIEW_LIST_ITEM = 'rounded bg-subtle px-3 py-2 text-xs' as const;

const SECTION_LABEL =
  'flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground' as const;

export function WorkspacesSidebar({ onOpenSettings }: WorkspacesSidebarProps) {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const onSelectSession = useCallback(
    (id: SessionId) => {
      void setCurrentSession(id);
    },
    [setCurrentSession],
  );
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);

  const warmedRef = useRef(false);
  useEffect(() => {
    if (warmedRef.current || sessions.length === 0) return;
    warmedRef.current = true;
    for (const s of sessions) {
      if (sessionBranches[s.id]) {
        void refreshSessionPr(s.id as SessionId);
      }
    }
  }, [sessions, sessionBranches, refreshSessionPr]);
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [archivedMap, archive, unarchive] = useArchivedSessions();
  const activeSessions = sessions.filter((s) => !archivedMap[s.id]);
  const archivedSessions = sessions.filter((s) => archivedMap[s.id]);

  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);
  const [githubDetailsOpen, setGithubDetailsOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* workspace select — also serves as window drag region */}
      <div data-tauri-drag-region className="shrink-0">
        <WorkspaceSelect onAddWorkspace={() => setAddWorkspaceOpen(true)} />
      </div>

      {/* activity bar + detail panel */}
      <div className="flex min-h-0 flex-1">
        {currentWorkspace ? (
          (() => {
            const hasAnySession = activeSessions.length > 0 || archivedSessions.length > 0;
            return (
              <>
                <div
                  className={cn(
                    'overflow-hidden transition-[width] duration-300 ease-out',
                    hasAnySession ? 'w-28' : 'w-0',
                  )}
                  aria-hidden={!hasAnySession}
                >
                  <SessionActivityBar
                    sessions={activeSessions}
                    archivedSessions={archivedSessions}
                    currentSessionId={currentSession?.id ?? null}
                    onSelectSession={onSelectSession}
                    onNewSession={() => setNewSessionOpen(true)}
                  />
                </div>
                <div
                  className={cn(
                    'mr-1.5 mt-1.5 mb-1.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-background transition-[margin-left] duration-300 ease-out dark:bg-muted',
                    hasAnySession ? 'ml-0' : 'ml-1.5',
                  )}
                >
                  {currentSession ? (
                    <>
                      <SessionDetailPanel
                        session={currentSession}
                        onOpenSessionSettings={() => setSessionSettingsOpen(true)}
                        onOpenGithubDetails={() => setGithubDetailsOpen(true)}
                      />
                      <ScrollArea className="min-h-0 flex-1">
                        <AgentsSection task={currentSession} />
                      </ScrollArea>
                      <SessionFilesTouchedFooter session={currentSession} />
                    </>
                  ) : (
                    <NoSessionSelectedEmpty
                      hasAnySession={hasAnySession}
                      onNewSession={() => setNewSessionOpen(true)}
                    />
                  )}
                </div>
              </>
            );
          })()
        ) : (
          <NoWorkspaceEmpty onAddWorkspace={() => setAddWorkspaceOpen(true)} />
        )}
      </div>

      {/* sidebar footer — logo + controls */}
      <div className="flex shrink-0 items-center px-2.5 py-2">
        <SidebarLogo />
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
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

      <AddWorkspaceDialog open={addWorkspaceOpen} onClose={() => setAddWorkspaceOpen(false)} />
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <PricingDialog open={pricingOpen} onClose={() => setPricingOpen(false)} />
      {currentWorkspace ? (
        <NewSessionDialog
          open={newSessionOpen}
          onClose={() => setNewSessionOpen(false)}
          workspaceId={currentWorkspace.id}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
      {currentSession ? (
        <SessionSettingsDialog
          sessionId={currentSession.id as SessionId}
          open={sessionSettingsOpen}
          onClose={() => setSessionSettingsOpen(false)}
          archived={!!archivedMap[currentSession.id]}
          onArchive={() => archive(currentSession.id as SessionId)}
          onUnarchive={() => unarchive(currentSession.id as SessionId)}
        />
      ) : null}
      <GithubDetailsDialog
        open={githubDetailsOpen}
        onClose={() => setGithubDetailsOpen(false)}
        sessionId={(currentSession?.id as SessionId) ?? null}
      />
    </div>
  );
}

function SidebarLogo() {
  return (
    <span className="flex items-center gap-1.5">
      <DogMascot size={16} className="shrink-0 text-foreground" />
      <span className="text-xs font-semibold tracking-tight text-foreground">kAY.am</span>
    </span>
  );
}

function NoSessionSelectedEmpty({
  hasAnySession,
  onNewSession,
}: {
  hasAnySession: boolean;
  onNewSession: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-full bg-info/10 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-info/10">
          <MessagesSquare size={26} className="text-info" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">
          {hasAnySession ? 'Ready when you are' : 'No sessions yet'}
        </h3>
        <p className="max-w-[220px] text-2xs leading-relaxed text-muted-foreground">
          {hasAnySession
            ? 'Pick a session from the list to dive in, or spin up a new one to start cooking.'
            : 'This workspace is empty. Spin up your first session to start working.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onNewSession}
        className="inline-flex items-center gap-1.5 rounded-md bg-info/15 px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/25"
      >
        <Plus size={12} aria-hidden />
        <span>{hasAnySession ? 'New session' : 'Create first session'}</span>
      </button>
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
          Add a git repo to spin up worktrees and start orchestrating sessions.
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

const ARCHIVED_KEY = STORAGE_KEYS.archivedTasks;

function readArchivedSet(): Record<string, true> {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, true> = {};
      for (const k of Object.keys(parsed as Record<string, unknown>)) out[k] = true;
      return out;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeArchivedSet(map: Record<string, true>): void {
  try {
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function useArchivedSessions(): [
  Record<string, true>,
  (id: SessionId) => void,
  (id: SessionId) => void,
] {
  const [map, setMap] = useState<Record<string, true>>(() => readArchivedSet());
  // Stable refs so memoized SessionRow downstream doesn't invalidate.
  const archive = useCallback((id: SessionId) => {
    setMap((prev) => {
      const next = { ...prev, [id]: true as const };
      writeArchivedSet(next);
      return next;
    });
  }, []);
  const unarchive = useCallback((id: SessionId) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[id];
      writeArchivedSet(next);
      return next;
    });
  }, []);
  return [map, archive, unarchive];
}

interface AddWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
}

function AddWorkspaceDialog({ open, onClose }: AddWorkspaceDialogProps) {
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<'repo' | 'skills' | 'workflows'>('repo');

  const reset = () => {
    setPath('');
    setError(null);
    setBusy(false);
    setActiveSection('repo');
  };

  const onPick = async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') {
      setPath(picked);
      setError(null);
    }
  };

  const onAdd = async () => {
    setError(null);
    setBusy(true);
    try {
      const ws = await addWorkspace({ rootPath: path });
      await setCurrentWorkspace(ws.id);
      reset();
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add workspace"
      description="point at a git repository on disk. each task creates its own worktree."
      size="lg"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onAdd()} disabled={path.length === 0 || busy}>
            {busy ? 'Adding…' : 'Add workspace'}
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 gap-0">
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-soft pr-2">
          <AddWsNavItem
            active={activeSection === 'repo'}
            onClick={() => setActiveSection('repo')}
            label="repository"
            ready={path.length > 0}
          />
          {WORKSPACE_FEATURES.skills ? (
            <AddWsNavItem
              active={activeSection === 'skills'}
              onClick={() => setActiveSection('skills')}
              label="skills"
              ready={null}
            />
          ) : null}
          <AddWsNavItem
            active={activeSection === 'workflows'}
            onClick={() => setActiveSection('workflows')}
            label="workflows"
            ready={null}
          />
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto pl-4">
          {activeSection === 'repo' ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">repository path</span>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={path}
                  placeholder="/path/to/repo"
                  onChange={(e) => setPath(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => void onPick()} disabled={busy}>
                  Browse
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                the directory must contain a `.git` folder.
              </p>
            </div>
          ) : null}

          {activeSection === 'skills' ? <AddWsSkillsPreview /> : null}

          {activeSection === 'workflows' ? <AddWsWorkflowsPreview /> : null}
        </div>
      </div>
    </Dialog>
  );
}

function AddWsNavItem({
  active,
  onClick,
  label,
  ready,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  ready: boolean | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm motion-safe:transition-colors',
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span className="flex-1">{label}</span>
      {ready === true ? (
        <span aria-label="filled" className="text-success text-2xs">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function AddWsSkillsPreview() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">skills discovered on add</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          after the workspace is registered, kay.am scans these locations and surfaces every skill
          it finds in chat as `/skill-name`. you don&rsquo;t need to author anything here; existing
          files are picked up automatically.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        <li className={PREVIEW_LIST_ITEM}>
          <code className="font-mono text-foreground">&lt;root&gt;/.kay/skills/*.md</code>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            flat directory of single-file skills (front-matter + body).
          </p>
        </li>
        <li className={PREVIEW_LIST_ITEM}>
          <code className="font-mono text-foreground">
            &lt;root&gt;/.claude/skills/&lt;name&gt;/SKILL.md
          </code>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            claude-cli-style skills (one folder per skill, optional sibling scripts).
          </p>
        </li>
      </ul>
      <p className="text-2xs text-muted-foreground/70">
        re-scan anytime from settings &rarr; skills.
      </p>
    </div>
  );
}

function AddWsWorkflowsPreview() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">workflow library auto-seeded</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          new workspaces get a small library of presets so the new-task dialog is never empty. you
          can edit, delete, or design custom ones via the planner later.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {WORKFLOW_LIBRARY.map((entry) => (
          <li key={entry.slug} className={PREVIEW_LIST_ITEM}>
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-foreground">{entry.name.toLowerCase()}</span>
              <span className="text-2xs text-muted-foreground">
                {entry.steps.length} step{entry.steps.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-1 leading-relaxed text-muted-foreground">{entry.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AgentsSectionProps {
  task: Session;
}

function AgentsSection({ task }: AgentsSectionProps) {
  const isTaskActive = useAppStore((s) => s.currentSessionId === task.id);
  const plansForTask = useSessionPlans(task.id);
  const latestPlan = plansForTask[plansForTask.length - 1];
  const hasActivePlan = !!latestPlan && latestPlan.status === 'active';
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const messages = useAppStore((s) => s.messages[task.id] ?? EMPTY_ARRAY);
  const agentRunHistory = useAppStore((s) => s.agentRunHistory);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const agentModelOverride = useAppStore((s) => s.agentModelOverride);
  const deleteAgent = useAppStore((s) => s.deleteAgent);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const workflow = task.workflowId
    ? (phaseTemplates.find((t) => t.id === task.workflowId) ?? null)
    : null;
  const slots = useSessionSlots(task.id);
  const loading = useSessionLoading(task.id);
  const hasOpenQuestions =
    (slots.find((s) => s.key === 'open_questions')?.value?.trim().length ?? 0) > 0;
  const summarizerBusy = useAppStore((s) => s.summarizerStatus[task.id]?.status === 'running');
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<AgentId | null>(null);

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);
  const initAgent = useMemo(
    () =>
      sorted.find((r) => (agentKindOverride[r.id] ?? inferAgentKindFromName(r.name)) === 'init') ??
      null,
    [sorted, agentKindOverride],
  );
  const nonInitSorted = useMemo(
    () =>
      sorted.filter((r) => (agentKindOverride[r.id] ?? inferAgentKindFromName(r.name)) !== 'init'),
    [sorted, agentKindOverride],
  );
  const workflowAgents = useMemo(
    () => nonInitSorted.filter((r) => r.stepId != null),
    [nonInitSorted],
  );
  const adHocAgents = useMemo(() => nonInitSorted.filter((r) => r.stepId == null), [nonInitSorted]);
  const actionableStepId = useMemo(() => {
    if (!workflow) return null;
    return pickNextWorkflowStep(workflow, sorted)?.id ?? null;
  }, [workflow, sorted]);
  const actionBlocked = hasOpenQuestions || summarizerBusy;

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
   * that agent — needed so the cost/tokens row in the sidebar doesn't drop
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
   * Most recent turn telemetry per agent — walks agentRunHistory newest-first so
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

  const renderAdHocRow = (run: Agent) => {
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

  return (
    <section className="mt-2 flex flex-col px-2 pb-3">
      {initAgent ? (
        <>
          <header className="flex items-center justify-between gap-2 pb-1.5">
            <span className={SECTION_LABEL}>
              <Terminal size={11} aria-hidden className="text-muted-foreground" />
              Init
            </span>
            <span className="truncate text-2xs text-muted-foreground/70">
              {initAgent.status === 'completed' ? 'done' : initAgent.status}
            </span>
          </header>
          <div className="flex flex-col gap-1 pl-2">
            <WorkflowStepRow
              run={initAgent}
              kind={agentKindOverride[initAgent.id] ?? 'init'}
              resolvedModel={
                agentModelOverride[initAgent.id] ??
                initAgent.modelOverride ??
                AGENT_KIND_DEFAULTS.init.model
              }
              isActionable={false}
              isBlocked={false}
              isSelected={initAgent.id === selectedAgentId}
              isEditing={false}
              telemetry={latestTelemetryByAgentId.get(initAgent.id) ?? null}
              aggregate={aggregatesByAgentId.get(initAgent.id) ?? null}
              turns={turnsByAgentId.get(initAgent.id) ?? 0}
              turnsLoading={initAgent.id === selectedAgentId && loading.transcript}
              onStart={() => undefined}
              onSelect={() => onPickAgent(initAgent.id)}
              onRenameStart={() => undefined}
              onRenameCommit={() => undefined}
              onRenameCancel={() => undefined}
            />
          </div>
        </>
      ) : null}
      {workflow && workflowAgents.length > 0 ? (
        <>
          <header
            className={cn('flex items-center justify-between gap-2 pb-1.5', initAgent && 'mt-6')}
          >
            <span className={SECTION_LABEL}>
              <Layers size={11} aria-hidden className="text-primary" />
              Workflow
            </span>
            <span className="truncate text-2xs text-muted-foreground/70">
              {workflowAgents.length} step{workflowAgents.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="flex flex-col gap-1 pl-2">
            {workflowAgents.map((run) => {
              const isActionable = run.stepId === actionableStepId && run.status === 'pending';
              const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
              const resolvedModel =
                agentModelOverride[run.id] ?? run.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
              return (
                <WorkflowStepRow
                  key={run.id}
                  run={run}
                  kind={kind}
                  resolvedModel={resolvedModel}
                  isActionable={isActionable}
                  isBlocked={isActionable && actionBlocked}
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
        </>
      ) : null}

      <header
        className={cn(
          'flex items-center justify-between gap-2 pb-1.5',
          ((workflow && workflowAgents.length > 0) || initAgent) && 'mt-6',
        )}
      >
        <span className={SECTION_LABEL}>
          <Bot size={11} aria-hidden className="text-success" />
          Agents
        </span>
        <span className="truncate text-2xs text-muted-foreground/70">
          {workflow
            ? adHocAgents.length === 0
              ? 'none'
              : `${adHocAgents.length} agent${adHocAgents.length === 1 ? '' : 's'}`
            : sorted.length === 0
              ? 'none yet'
              : `${sorted.length} agent${sorted.length === 1 ? '' : 's'}`}
        </span>
      </header>
      {workflow ? (
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
      {hasActivePlan ? null : <ActivePlanCta sessionId={task.id} />}
      <div className="mt-2 px-2">
        <div className="rounded border border-dashed border-border-soft px-3 py-2">
          <p className="text-2xs font-medium text-muted-foreground">Next</p>
          <p className="text-2xs text-muted-foreground/60">temporarily disabled</p>
        </div>
      </div>
      <div className="pl-2">
        <SpawnAgentControl sessionId={task.id} />
      </div>
      {spawnError ? <p className="mt-1 px-2 text-2xs text-danger">{spawnError}</p> : null}
    </section>
  );
}

interface SpawnAgentControlProps {
  sessionId: SessionId;
}

function SpawnAgentControl({ sessionId }: SpawnAgentControlProps) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const onToggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        // Open in the direction with more room. Trigger near the top of
        // the viewport → open downward (avoids clipping under the sticky
        // panel header); trigger near the bottom → open upward.
        setDirection(spaceBelow > spaceAbove ? 'down' : 'up');
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative mt-1" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={13} aria-hidden />
        Spawn agent
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute left-0 right-0 z-20 max-h-72 overflow-y-auto rounded bg-subtle py-1 text-xs shadow-lg ring-1 ring-border-soft',
            direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted-foreground/70">
            by role
          </div>
          {[...AGENT_KIND_ORDER]
            .filter((k) => k !== 'init')
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
        </div>
      ) : null}
    </div>
  );
}

function ActivePlanCta({ sessionId }: { sessionId: SessionId }) {
  const plans = useSessionPlans(sessionId);
  const runPlan = useAppStore((s) => s.runPlan);
  const abandonPlan = useAppStore((s) => s.abandonPlan);
  const [spawning, setSpawning] = useState(false);
  const latest = plans[plans.length - 1];
  if (!latest || latest.status !== 'active') return null;

  const handleTrigger = async () => {
    if (spawning) return;
    setSpawning(true);
    try {
      await runPlan(sessionId, latest.id);
    } finally {
      setSpawning(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-1 pl-2">
      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
        <ClipboardList size={11} aria-hidden className="text-primary" />
        active plan
      </div>
      <span className="truncate text-xs text-foreground" title={latest.title}>
        {latest.title}
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => void handleTrigger()}
          disabled={spawning}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10',
            spawning && 'cursor-not-allowed opacity-60',
          )}
          title="spawn new agent to execute this plan"
        >
          {spawning ? (
            <Loader2 size={11} aria-hidden className="animate-spin" />
          ) : (
            <Play size={11} aria-hidden />
          )}
          trigger plan
        </button>
        <button
          type="button"
          onClick={() => void abandonPlan(sessionId, latest.id)}
          className="rounded border border-border-soft px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title="mark plan as superseded; next plan emitted starts a new logical plan"
        >
          abandon
        </button>
      </div>
    </div>
  );
}

const AGENT_STATUS_TONE: Record<AgentStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-info',
  completed: 'bg-success',
  failed: 'bg-danger',
  skipped: 'bg-muted-foreground/20',
};

interface WorkflowStepRowProps {
  readonly run: Agent;
  readonly kind: AgentKind;
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
  const containerClass = isStartable
    ? `${ROW_BASE} border-primary/40 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/20 cursor-pointer`
    : isActionable && isBlocked
      ? `${ROW_BASE} border-warning/50 bg-warning/10 text-foreground transition-colors hover:border-warning hover:bg-warning/15 cursor-pointer`
      : isPendingFuture
        ? `${ROW_BASE} border-transparent text-muted-foreground/40`
        : cn(
            `${ROW_BASE} transition-colors cursor-pointer`,
            isSelected
              ? 'border-border bg-muted text-foreground'
              : 'border-border-soft/50 bg-subtle/50 text-foreground/80 hover:border-border hover:bg-muted/50',
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
        'group rounded transition-colors',
        isEditing ? '' : 'cursor-pointer',
        isSelected ? 'bg-muted' : 'hover:bg-muted/60',
        agentHasUnread(run, isSelected && isTaskActive) && 'ring-1 ring-inset ring-warning/70',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5" title={titleParts.join('\n')}>
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
              <span
                aria-hidden
                className="relative inline-flex h-1.5 w-1.5 shrink-0 group-hover:hidden"
                title={`status: ${run.status}`}
              >
                {run.status === 'running' && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
                )}
                <span
                  className={cn(
                    'relative inline-block h-1.5 w-1.5 rounded-full',
                    AGENT_STATUS_TONE[run.status],
                  )}
                />
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

function formatRelativeDuration(fromIso: string, toIso?: string): string {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) return '';
  const toMs = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(toMs)) return '';
  const diff = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function AgentLifetime({ run }: { run: Agent }) {
  const [now, setNow] = useState(() => Date.now());
  const isLive = !!run.startedAt && !run.completedAt;
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [isLive]);

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
  const dotNow = now;
  void dotNow; // recalculation trigger
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

interface BulkSessionDeleteDialogProps {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function BulkSessionDeleteDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
  onDeleted,
}: BulkSessionDeleteDialogProps) {
  const sessions = useSessions();
  const bulkDelete = useAppStore((s) => s.bulkDeleteSessionsForWorkspace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceSessions = sessions.filter((s) => s.workspaceId === workspaceId);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await bulkDelete(
        workspaceId,
        workspaceSessions.map((s) => s.id as SessionId),
      );
      onDeleted();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Delete all sessions?"
      description={`disconnecting "${workspaceName}" will permanently remove all ${workspaceSessions.length} session${workspaceSessions.length === 1 ? '' : 's'} listed below. worktrees, transcripts, and audit logs will be deleted. this cannot be undone.`}
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete all & disconnect'}
          </Button>
        </>
      }
    >
      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {workspaceSessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded border border-border-soft bg-subtle px-3 py-1.5 text-xs"
          >
            <span className="min-w-0 truncate font-mono text-foreground">{s.goal}</span>
            <span className="shrink-0 text-muted-foreground/60">
              {new Date(s.updatedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
