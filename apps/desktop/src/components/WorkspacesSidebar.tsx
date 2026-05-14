import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea, cn } from '@kay-am/ui';
import {
  ArrowRight,
  ArrowUpDown,
  Bot,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Gauge,
  GitFork,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestDraft,
  HelpCircle,
  MessagesSquare,
  Moon,
  Plus,
  Settings,
  Settings2,
  Sun,
  Trash2,
  Users,
  Workflow as WorkflowIcon,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';
import { SessionSettingsDialog } from './SessionSettingsDialog';
import { GuideDialog } from './GuideDialog';
import { ProvidersChip } from './ProvidersChip';
import { NotificationCenter } from './NotificationCenter';
import { TelemetryPill } from './TelemetryPill';
import type {
  ProviderId,
  PullRequestStateKind,
  Session,
  SessionId,
  SessionStatus,
  Step,
  Task,
  TaskId,
  TelemetryRecord,
  TurnState,
  Workflow,
  Workspace,
  WorkspaceId,
} from '@kay-am/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionNextActions,
  useSessionSlots,
  useSessions,
  useWorkspaces,
} from '../store';
import { NewSessionDialog } from './NewSessionDialog';
import { StatusBadge } from './StatusBadge';
import { WorkflowNextStepCta } from './WorkflowNextStepCta';
import { CostBadge } from './CostBadge';
import {
  computeLatestTelemetryByAgentId,
  formatCost,
  formatTokens,
  shortModel,
} from '../agentRowFormat';
import { PROVIDER_CAPABILITIES, WORKFLOW_LIBRARY, type NextAction } from '@kay-am/core';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  type AgentKind,
  inferAgentKindFromName,
} from '../agentKind';
import { spawnFromNextAction, spawnKindForAction } from '../spawnFromNextAction';
import { openUrl } from '../editor';
import { useThemeStore } from '../theme';
import { STORAGE_KEYS } from '../storage-keys';

interface WorkspacesSidebarProps {
  onOpenSettings: () => void;
}

const PROVIDER_SHORT: Record<ProviderId, string> = {
  anthropic: 'cl',
  cursor: 'cu',
  codex: 'cx',
};

const STATE_FILTER_OPTIONS: ReadonlyArray<TurnState['kind']> = [
  'idle',
  'running',
  'ended',
  'error',
];

const PROVIDER_FILTER_OPTIONS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

type SessionSort = 'updated' | 'alpha';

export function WorkspacesSidebar({ onOpenSettings }: WorkspacesSidebarProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);

  const sidebarStateFilter = useAppStore((s) => s.sidebarStateFilter);
  const sidebarProviderFilter = useAppStore((s) => s.sidebarProviderFilter);
  const setSidebarStateFilter = useAppStore((s) => s.setSidebarStateFilter);
  const setSidebarProviderFilter = useAppStore((s) => s.setSidebarProviderFilter);

  const [sessionSort, setSessionSort] = useState<SessionSort>('updated');

  const warmedRef = useRef(false);
  useEffect(() => {
    if (warmedRef.current || sessions.length === 0) return;
    warmedRef.current = true;
    for (const s of sessions) {
      if (sessionBranches[s.id]) {
        void refreshSessionPr(s.id as TaskId);
      }
    }
  }, [sessions, sessionBranches, refreshSessionPr]);
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const filteredWorkspaces = useMemo(
    () => [...workspaces].sort((a, b) => a.name.localeCompare(b.name)),
    [workspaces],
  );

  const filteredSessions = sessions.filter((s) => {
    const matchesState =
      sidebarStateFilter.length === 0 || sidebarStateFilter.includes(s.state.kind);
    const matchesProvider =
      sidebarProviderFilter.length === 0 ||
      sidebarProviderFilter.includes(s.providerPreference.defaultProvider);
    return matchesState && matchesProvider;
  });

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [archivedMap, archive, unarchive] = useArchivedTasks();
  const activeSessions = filteredSessions.filter((s) => !archivedMap[s.id]);
  const archivedSessions = filteredSessions.filter((s) => archivedMap[s.id]);

  const toggleStateFilter = (kind: TurnState['kind']) => {
    const next = sidebarStateFilter.includes(kind)
      ? sidebarStateFilter.filter((k) => k !== kind)
      : [...sidebarStateFilter, kind];
    setSidebarStateFilter(next);
  };

  const toggleProviderFilter = (provider: ProviderId) => {
    const next = sidebarProviderFilter.includes(provider)
      ? sidebarProviderFilter.filter((p) => p !== provider)
      : [...sidebarProviderFilter, provider];
    setSidebarProviderFilter(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-2 py-2">
        <KayAmLogo />
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === 'dark' ? <Sun size={13} aria-hidden /> : <Moon size={13} aria-hidden />}
          </button>
          <NotificationCenter />
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            title="getting started — guide"
            aria-label="open getting started guide"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HelpCircle size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title="settings (⌘,)"
            aria-label="open settings"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings size={13} aria-hidden />
          </button>
        </div>
      </div>

      <ScrollArea className="max-h-[40%] shrink-0">
        <section className="flex flex-col px-2">
          <header className="flex items-center justify-between gap-2 pb-1.5">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <FolderOpen size={11} aria-hidden className="text-primary" />
              Workspaces
            </span>
          </header>
          <ul className="flex flex-col gap-0.5 pl-2">
            {filteredWorkspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isActive={ws.id === currentWorkspace?.id}
                onClick={() => void setCurrentWorkspace(ws.id)}
              />
            ))}
            <li>
              <AddRow
                label="add workspace"
                icon={<FolderPlus size={13} aria-hidden />}
                onClick={() => setAddWorkspaceOpen(true)}
              />
            </li>
          </ul>
        </section>
      </ScrollArea>

      <ScrollArea className="mt-8 flex-1">
        <section className="flex flex-col px-2">
          <header className="flex items-center justify-between gap-2 pb-1.5">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <MessagesSquare size={11} aria-hidden className="text-info" />
              Sessions
            </span>
            <div className="flex items-center gap-1.5">
              {currentWorkspace ? (
                <span className="max-w-[80px] truncate text-2xs text-muted-foreground/70">
                  {currentWorkspace.name}
                </span>
              ) : null}
              <SortIconButton sort={sessionSort} onChange={setSessionSort} />
            </div>
          </header>
          {currentWorkspace ? (
            <div className="pl-2">
              <SessionList
                activeSessions={activeSessions}
                archivedSessions={archivedSessions}
                currentSessionId={currentSession?.id ?? null}
                sort={sessionSort}
                stateFilter={sidebarStateFilter}
                providerFilter={sidebarProviderFilter}
                stateFilterOptions={STATE_FILTER_OPTIONS}
                providerFilterOptions={PROVIDER_FILTER_OPTIONS}
                onToggleState={toggleStateFilter}
                onToggleProvider={toggleProviderFilter}
                onSelectSession={(id) => {
                  if (id === currentSession?.id) return;
                  void setCurrentSession(id);
                }}
                onNewSession={() => setNewSessionOpen(true)}
                onArchive={archive}
                onUnarchive={unarchive}
              />
            </div>
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground/70">
              Select a workspace to see its sessions.
            </p>
          )}
        </section>

        {currentSession ? <AgentsSection task={currentSession} /> : null}
      </ScrollArea>

      <div className="flex shrink-0 flex-col items-center gap-1.5 px-2 pb-2 pt-1.5">
        <ProvidersChip />
        <TelemetryPill />
      </div>

      <AddWorkspaceDialog open={addWorkspaceOpen} onClose={() => setAddWorkspaceOpen(false)} />
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      {currentWorkspace ? (
        <NewSessionDialog
          open={newSessionOpen}
          onClose={() => setNewSessionOpen(false)}
          workspaceId={currentWorkspace.id}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
    </div>
  );
}

function KayAmLogo() {
  return (
    <span className="flex items-center gap-1.5 px-1">
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden
        className="shrink-0 text-foreground"
      >
        <circle cx="9" cy="9" r="3.5" fill="currentColor" opacity="0.9" />
        <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
        <line x1="9" y1="1" x2="9" y2="17" stroke="currentColor" strokeWidth="1" opacity="0.2" />
        <line x1="1" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      </svg>
      <span className="text-sm font-semibold tracking-tight text-foreground">kAY.am</span>
    </span>
  );
}

interface WorkspaceRowProps {
  workspace: Workspace;
  isActive: boolean;
  onClick: () => void;
}

function WorkspaceRow({ workspace, isActive, onClick }: WorkspaceRowProps) {
  const [wsSettingsOpen, setWsSettingsOpen] = useState(false);

  return (
    <li className="group">
      <div
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors',
          isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/60',
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
        >
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              isActive ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
            aria-hidden
          />
          <FolderOpen
            size={13}
            aria-hidden
            className={cn('shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}
          />
          <span className="line-clamp-1 flex-1 font-medium">{workspace.name}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWsSettingsOpen(true);
          }}
          className="mr-1 shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground group-hover:text-muted-foreground"
          title="Workspace settings (incl. disconnect)"
          aria-label={`Settings for workspace ${workspace.name}`}
        >
          <Settings2 size={12} aria-hidden />
        </button>
      </div>
      <WorkspaceSettingsDialog
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        open={wsSettingsOpen}
        onClose={() => setWsSettingsOpen(false)}
      />
    </li>
  );
}

interface SessionListProps {
  activeSessions: ReadonlyArray<Task>;
  archivedSessions: ReadonlyArray<Task>;
  currentSessionId: TaskId | null;
  sort: SessionSort;
  stateFilter: ReadonlyArray<TurnState['kind']>;
  providerFilter: ReadonlyArray<ProviderId>;
  stateFilterOptions: ReadonlyArray<TurnState['kind']>;
  providerFilterOptions: ReadonlyArray<ProviderId>;
  onToggleState: (kind: TurnState['kind']) => void;
  onToggleProvider: (provider: ProviderId) => void;
  onSelectSession: (id: TaskId) => void;
  onNewSession: () => void;
  onArchive: (id: TaskId) => void;
  onUnarchive: (id: TaskId) => void;
}

function SessionList({
  activeSessions,
  archivedSessions,
  currentSessionId,
  sort,
  stateFilter,
  providerFilter,
  stateFilterOptions,
  providerFilterOptions,
  onToggleState,
  onToggleProvider,
  onSelectSession,
  onNewSession,
  onArchive,
  onUnarchive,
}: SessionListProps) {
  const [archivedOpen, setArchivedOpen] = useState(false);

  const sortedActive = useMemo(() => sortSessions(activeSessions, sort), [activeSessions, sort]);
  const sortedArchived = useMemo(
    () => sortSessions(archivedSessions, sort),
    [archivedSessions, sort],
  );
  return (
    <div className="flex flex-col gap-1">
      {stateFilter.length > 0 || providerFilter.length > 0 ? (
        <div className="flex flex-wrap gap-0.5">
          {stateFilter.map((k) => (
            <FilterChip key={k} label={k} onRemove={() => onToggleState(k)} />
          ))}
          {providerFilter.map((p) => (
            <FilterChip
              key={p}
              label={PROVIDER_SHORT[p] ?? p}
              onRemove={() => onToggleProvider(p)}
            />
          ))}
        </div>
      ) : null}

      {(stateFilter.length > 0 || providerFilter.length > 0) && (
        <details>
          <summary className="cursor-pointer text-2xs uppercase tracking-wide text-muted-foreground hover:text-foreground">
            edit filters
          </summary>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {stateFilterOptions.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onToggleState(kind)}
                className={cn(
                  'rounded px-1 py-0.5 text-2xs font-medium uppercase tracking-wide transition-colors',
                  stateFilter.includes(kind)
                    ? 'bg-foreground/15 text-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {kind}
              </button>
            ))}
            {providerFilterOptions.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onToggleProvider(p)}
                className={cn(
                  'rounded px-1 py-0.5 text-2xs font-medium uppercase tracking-wide transition-colors',
                  providerFilter.includes(p)
                    ? 'bg-foreground/15 text-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {PROVIDER_SHORT[p]}
              </button>
            ))}
          </div>
        </details>
      )}

      <ul className="flex flex-col gap-0.5">
        {sortedActive.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isActive={session.id === currentSessionId}
            onClick={() => onSelectSession(session.id)}
            archived={false}
            onArchive={() => onArchive(session.id)}
            onUnarchive={() => onUnarchive(session.id)}
          />
        ))}
        <li>
          <AddRow
            label="add session"
            icon={<Plus size={13} aria-hidden />}
            onClick={onNewSession}
          />
        </li>
      </ul>

      {sortedArchived.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setArchivedOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-1 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
            aria-expanded={archivedOpen}
          >
            {archivedOpen ? (
              <ChevronDown size={11} aria-hidden />
            ) : (
              <ChevronRight size={11} aria-hidden />
            )}
            archived ({sortedArchived.length})
          </button>
          {archivedOpen && (
            <ul className="flex flex-col gap-0.5 opacity-70">
              {sortedArchived.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  onClick={() => onSelectSession(session.id)}
                  archived
                  onArchive={() => onArchive(session.id)}
                  onUnarchive={() => onUnarchive(session.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const SORT_OPTIONS: ReadonlyArray<{ value: SessionSort; label: string }> = [
  { value: 'updated', label: 'recent' },
  { value: 'alpha', label: 'a → z' },
];

function SortIconButton({
  sort,
  onChange,
}: {
  sort: SessionSort;
  onChange: (s: SessionSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Sort: ${current.label}`}
        aria-label="Sort sessions"
      >
        <ArrowUpDown size={12} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-md bg-background py-1 text-xs shadow-lg ring-1 ring-border-soft"
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
                opt.value === sort ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span>{opt.label}</span>
              {opt.value === sort ? <span className="text-2xs">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function sortSessions(list: ReadonlyArray<Task>, sort: SessionSort): ReadonlyArray<Task> {
  const copy = [...list];
  if (sort === 'alpha') copy.sort((a, b) => a.goal.localeCompare(b.goal));
  else copy.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return copy;
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

function useArchivedTasks(): [Record<string, true>, (id: TaskId) => void, (id: TaskId) => void] {
  const [map, setMap] = useState<Record<string, true>>(() => readArchivedSet());
  const archive = (id: TaskId) => {
    setMap((prev) => {
      const next = { ...prev, [id]: true as const };
      writeArchivedSet(next);
      return next;
    });
  };
  const unarchive = (id: TaskId) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[id];
      writeArchivedSet(next);
      return next;
    });
  };
  return [map, archive, unarchive];
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-foreground/10 px-1 py-0.5 text-2xs text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-danger"
        aria-label={`remove filter ${label}`}
      >
        <X size={9} aria-hidden />
      </button>
    </span>
  );
}

const PR_ICON_MAP: Record<
  Exclude<PullRequestStateKind, 'closed'>,
  { icon: React.ElementType; label: string; className: string }
> = {
  draft: {
    icon: GitPullRequestDraft,
    label: 'draft',
    className: 'text-muted-foreground',
  },
  open: {
    icon: GitPullRequest,
    label: 'open',
    className: 'text-muted-foreground',
  },
  approved: {
    icon: GitPullRequestArrow,
    label: 'approved',
    className: 'text-success',
  },
  merged: {
    icon: GitFork,
    label: 'merged',
    className: 'text-muted-foreground',
  },
};

interface PrStatusIconProps {
  taskId: TaskId;
}

function PrStatusIcon({ taskId }: PrStatusIconProps) {
  const github = useAppStore((s) => s.sessionGithub[taskId]);
  const branch = useAppStore((s) => s.sessionBranches[taskId]);

  if (!branch || !github?.pr || github.pr.state === 'closed') return null;

  const { pr } = github;
  const entry = PR_ICON_MAP[pr.state as Exclude<PullRequestStateKind, 'closed'>];
  if (!entry) return null;

  const Icon = entry.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    void openUrl(pr.url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`PR #${pr.number} — ${entry.label}`}
      aria-label={`PR #${pr.number} — ${entry.label}`}
      className={cn('shrink-0 rounded p-0.5 transition-colors hover:bg-muted', entry.className)}
    >
      <Icon size={12} aria-hidden />
    </button>
  );
}

interface SessionRowProps {
  session: Task;
  isActive: boolean;
  onClick: () => void;
  archived: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
}

function SessionRow({
  session,
  isActive,
  onClick,
  archived,
  onArchive,
  onUnarchive,
}: SessionRowProps) {
  const budget = useAppStore((s) => s.sessionBudgets[session.id as TaskId] ?? null);
  const spentUsd = useAppStore((s) => s.sessionSummary?.estimatedCostUsd ?? null);
  const agentCount = useAppStore((s) => s.sessionPhaseRuns[session.id as TaskId]?.length ?? 0);
  const workflowName = useAppStore((s) => {
    if (!session.workflowId) return null;
    const templates = s.phaseTemplates[session.workspaceId] ?? [];
    return templates.find((t) => t.id === session.workflowId)?.name ?? null;
  });
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const setSessionAutoRun = useAppStore((s) => s.setSessionAutoRun);
  const renameTask = useAppStore((s) => s.renameTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const budgetLoaded = useRef(false);

  const [editingCap, setEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!budgetLoaded.current) {
      budgetLoaded.current = true;
      void loadSessionBudget(session.id as TaskId);
    }
  }, [session.id, loadSessionBudget]);

  const spent = isActive ? (spentUsd ?? 0) : 0;
  const cap = budget?.softCapUsd ?? null;
  const pct = cap !== null && cap > 0 ? spent / cap : null;

  const barColor =
    pct === null ? '' : pct >= 1 ? 'bg-danger' : pct >= 0.8 ? 'bg-warning' : 'bg-muted-foreground';

  const onCapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCapDraft(cap !== null ? String(cap) : '');
    setEditingCap(true);
  };

  const onCapSave = async () => {
    const parsed = parseFloat(capDraft);
    if (!isNaN(parsed) && parsed > 0) {
      await setSessionBudget(session.id as TaskId, parsed);
    }
    setEditingCap(false);
  };

  const onCapKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void onCapSave();
    if (e.key === 'Escape') setEditingCap(false);
  };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameDraft(session.goal);
    setRenameError(null);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (!renameDraft.trim()) {
      setRenameError('name cannot be empty');
      return;
    }
    try {
      await renameTask(session.id as TaskId, renameDraft.trim());
      setRenaming(false);
      setRenameError(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : String(err));
    }
  };

  const onRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void commitRename();
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameError(null);
    }
  };

  const onDeleteConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteTask(session.id as TaskId);
    setConfirmDelete(false);
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick();
        }}
        onDoubleClick={startRename}
        className={cn(
          'group flex cursor-pointer flex-col gap-1 rounded-md px-2 py-1.5 transition-colors',
          isActive ? 'bg-muted' : 'hover:bg-muted/60',
        )}
      >
        <div className="flex min-w-0 w-full items-center gap-2 text-sm">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              isActive ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
            aria-hidden
          />
          {renaming ? (
            <div
              className="flex min-w-0 flex-1 flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={onRenameKeyDown}
                className="flex-1 rounded border border-border bg-background px-1 py-0 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
              {renameError ? <span className="text-2xs text-danger">{renameError}</span> : null}
            </div>
          ) : (
            <span className="line-clamp-1 min-w-0 flex-1 truncate">{session.goal}</span>
          )}
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <PrStatusIcon taskId={session.id as TaskId} />
            <StatusBadge state={session.state} />
            {session.workflowId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void setSessionAutoRun(session.id as TaskId, !session.autoRun);
                }}
                title={
                  session.autoRun ? 'autorun on — click to pause' : 'autorun off — click to enable'
                }
                aria-label={session.autoRun ? 'autorun on' : 'autorun off'}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  session.autoRun
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground',
                )}
              >
                {session.autoRun ? <Zap size={11} aria-hidden /> : <ZapOff size={11} aria-hidden />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              title="session settings (rename · budget · archive · delete)"
              aria-label="session settings"
            >
              <Settings2 size={12} aria-hidden />
            </button>
          </div>
        </div>

        {isActive && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-3.5 text-2xs text-muted-foreground">
            {workflowName ? (
              <span className="inline-flex min-w-0 items-center gap-1" title="workflow">
                <WorkflowIcon size={10} aria-hidden className="shrink-0" />
                <span className="truncate">{workflowName.toLowerCase()}</span>
              </span>
            ) : null}
            <span
              className="inline-flex items-center gap-1"
              title={`${agentCount} agent${agentCount === 1 ? '' : 's'}`}
            >
              <Users size={10} aria-hidden />
              <span className="tabular-nums">{agentCount}</span>
            </span>
            {spentUsd !== null && spentUsd > 0 ? (
              <CostBadge
                value={spentUsd}
                title={`$${spentUsd.toFixed(4)} total session cost`}
                className="text-2xs"
              />
            ) : null}
          </div>
        )}

        {cap !== null && (
          <div className="flex flex-col gap-0.5 pl-3.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.min((pct ?? 0) * 100, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted-foreground">
                ${spent.toFixed(2)} /{' '}
                {editingCap ? null : (
                  <button
                    type="button"
                    className="text-2xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={onCapClick}
                    title="click to edit cap"
                  >
                    ${cap.toFixed(2)}
                  </button>
                )}
              </span>
              {editingCap && (
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                  onBlur={() => void onCapSave()}
                  onKeyDown={onCapKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1 w-16 rounded border border-border bg-background px-1 py-0 text-2xs outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <DeleteConfirmDialog
          sessionGoal={session.goal}
          onConfirm={onDeleteConfirm}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <SessionSettingsDialog
        taskId={session.id as TaskId}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        archived={archived}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
    </li>
  );
}

interface DeleteConfirmDialogProps {
  sessionGoal: string;
  onConfirm: (e: React.MouseEvent) => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ sessionGoal, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title="delete session?"
      description={`"${sessionGoal}" will be permanently removed. worktree, transcripts, and audit logs will be deleted. this cannot be undone.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            delete
          </Button>
        </>
      }
    >
      <span />
    </Dialog>
  );
}

interface AddRowProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function AddRow({ label, icon, onClick }: AddRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-0.5 flex w-full items-center gap-2 rounded-md border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
    >
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="add workspace"
      description="point at a git repository on disk. each task creates its own worktree."
      size="lg"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            cancel
          </Button>
          <Button onClick={() => void onAdd()} disabled={path.length === 0 || busy}>
            {busy ? 'adding…' : 'add workspace'}
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
          <AddWsNavItem
            active={activeSection === 'skills'}
            onClick={() => setActiveSection('skills')}
            label="skills"
            ready={null}
          />
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
                  browse
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
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm motion-safe:transition-colors',
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
          it finds in chat as `/skill-name`. you don&rsquo;t need to author anything here — existing
          files are picked up automatically.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        <li className="rounded-md bg-subtle px-3 py-2 text-xs">
          <code className="font-mono text-foreground">&lt;root&gt;/.kay/skills/*.md</code>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            flat directory of single-file skills (front-matter + body).
          </p>
        </li>
        <li className="rounded-md bg-subtle px-3 py-2 text-xs">
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
          <li key={entry.slug} className="rounded-md bg-subtle px-3 py-2 text-xs">
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
  task: Task;
}

function AgentsSection({ task }: AgentsSectionProps) {
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Session>),
  );
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const messages = useAppStore((s) => s.messages[task.id] ?? EMPTY_ARRAY);
  const agentRunHistory = useAppStore((s) => s.agentRunHistory);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const deleteAgent = useAppStore((s) => s.deleteAgent);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const workflow = task.workflowId
    ? (phaseTemplates.find((t) => t.id === task.workflowId) ?? null)
    : null;
  const slots = useSessionSlots(task.id);
  const hasOpenQuestions =
    (slots.find((s) => s.key === 'open_questions')?.value?.trim().length ?? 0) > 0;
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<SessionId | null>(null);

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);

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

  const onPickAgent = (sid: SessionId) => {
    if (sid === selectedAgentId) return;
    void selectAgent(task.id, sid);
  };

  const onSpawn = async (stepId: Step['id'] | null, model?: string) => {
    setSpawnError(null);
    try {
      await spawnAgent(task.id, stepId ? { stepId, ...(model !== undefined && { model }) } : {});
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : String(err));
    }
  };

  const onRenameCommit = async (id: SessionId, name: string) => {
    setEditingId(null);
    try {
      await renameAgent(task.id, id, name);
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : String(err));
    }
  };

  const onDeleteAgent = async (id: SessionId) => {
    try {
      await deleteAgent(task.id, id);
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="mt-8 flex flex-col px-2 pb-3">
      <header className="flex items-center justify-between gap-2 pb-1.5">
        <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Bot size={11} aria-hidden className="text-success" />
          Agents
        </span>
        <span className="truncate text-2xs text-muted-foreground/70">
          {sorted.length === 0
            ? 'none yet'
            : `${sorted.length} agent${sorted.length === 1 ? '' : 's'}`}
        </span>
      </header>
      {sorted.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground/70">
          No agents yet — spawn one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 pl-2">
          {sorted.map((run) => {
            const stepName = run.stepId
              ? (workflow?.steps.find((s) => s.id === run.stepId)?.name ?? null)
              : null;
            const kind = inferAgentKindFromName(stepName ?? run.name);
            return (
              <AgentRow
                key={run.id}
                run={run}
                kind={kind}
                telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
                aggregate={aggregatesByAgentId.get(run.id) ?? null}
                turns={turnsByAgentId.get(run.id) ?? 0}
                isSelected={run.id === selectedAgentId}
                isEditing={editingId === run.id}
                onClick={() => onPickAgent(run.id)}
                onRenameStart={() => setEditingId(run.id)}
                onRenameCommit={(name) => void onRenameCommit(run.id, name)}
                onRenameCancel={() => setEditingId(null)}
                onDelete={() => void onDeleteAgent(run.id)}
              />
            );
          })}
        </ul>
      )}
      {workflow ? (
        <div className="mt-2 pl-2">
          <WorkflowNextStepCta
            workflow={workflow}
            runs={sorted}
            onAdvance={(step, model) => onSpawn(step.id, model)}
            hasOpenQuestions={hasOpenQuestions}
          />
        </div>
      ) : null}
      <div className="pl-2">
        <SpawnAgentControl taskId={task.id} workflow={workflow} onSpawn={onSpawn} />
      </div>
      {spawnError ? <p className="mt-1 px-2 text-2xs text-danger">{spawnError}</p> : null}
    </section>
  );
}

interface SpawnAgentControlProps {
  taskId: TaskId;
  workflow: Workflow | null;
  onSpawn: (stepId: Step['id'] | null, model?: string) => void | Promise<void>;
}

function SpawnAgentControl({ taskId, workflow, onSpawn }: SpawnAgentControlProps) {
  const [open, setOpen] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<NextAction | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const nextActions = useSessionNextActions(taskId);
  const slots = useSessionSlots(taskId);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const clearSessionNextActions = useAppStore((s) => s.clearSessionNextActions);
  const hasOpenQuestions =
    (slots.find((s) => s.key === 'open_questions')?.value?.trim().length ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const sortedSteps = useMemo(
    () => (workflow ? [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal) : []),
    [workflow],
  );

  const suggestions = workflow ? [] : nextActions;

  const executeSuggestion = async (action: NextAction) => {
    setPendingSuggestion(null);
    const did = await spawnFromNextAction(action, taskId, spawnAgent);
    if (did) clearSessionNextActions(taskId);
  };

  const onPickSuggestion = (action: NextAction) => {
    setOpen(false);
    if (hasOpenQuestions) {
      setPendingSuggestion(action);
      return;
    }
    void executeSuggestion(action);
  };

  return (
    <div className="relative mt-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={13} aria-hidden />
        spawn agent
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-72 overflow-y-auto rounded-md bg-background py-1 text-xs shadow-lg ring-1 ring-border-soft"
        >
          {suggestions.length > 0 ? (
            <>
              <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted-foreground/70">
                suggested next
              </div>
              {suggestions.map((action) => (
                <SuggestionMenuItem
                  key={action.id}
                  action={action}
                  onSelect={() => void onPickSuggestion(action)}
                />
              ))}
              <div className="mt-1 border-t border-border-soft" aria-hidden />
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onSpawn(null);
            }}
            className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <span className="font-medium text-foreground">+ free agent</span>
            <span className="text-2xs text-muted-foreground">no role</span>
          </button>
          {sortedSteps.length > 0 ? (
            <>
              <div className="mt-1 border-t border-border-soft" aria-hidden />
              <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted-foreground/70">
                from workflow
              </div>
              {sortedSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    void onSpawn(step.id, step.modelOverride);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{step.name}</span>
                  {step.modelOverride ? (
                    <span className="text-2xs text-muted-foreground">
                      {shortModel(step.modelOverride)}
                    </span>
                  ) : null}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {pendingSuggestion ? (
        <div className="mt-1.5 rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-[11px]">
          <p className="mb-2 font-medium text-foreground">
            open questions need resolution before spawning an agent.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingSuggestion(null)}
              className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground hover:opacity-90"
            >
              resolve first
            </button>
            <button
              type="button"
              onClick={() => void executeSuggestion(pendingSuggestion)}
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

function SuggestionMenuItem({ action, onSelect }: { action: NextAction; onSelect: () => void }) {
  const kind = spawnKindForAction(action);
  const palette = kind ? AGENT_KIND_PALETTE[kind] : null;
  const defaults = kind ? AGENT_KIND_DEFAULTS[kind] : null;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      title={defaults ? `${defaults.model} · ${defaults.effort} effort` : action.label}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors',
        palette ? `${palette.bg} ${palette.fg} hover:opacity-90` : 'hover:bg-muted',
      )}
    >
      <span className="flex items-center gap-1.5">
        <ArrowRight size={11} aria-hidden />
        <span className="font-medium">{action.label}</span>
      </span>
      {defaults ? <span className="text-2xs opacity-70">{shortModel(defaults.model)}</span> : null}
    </button>
  );
}

const AGENT_STATUS_TONE: Record<SessionStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-info animate-pulse',
  completed: 'bg-success',
  failed: 'bg-danger',
  skipped: 'bg-muted-foreground/20',
};

interface AgentAggregate {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly turns: number;
}

interface AgentRowProps {
  readonly run: Session;
  readonly kind: AgentKind;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly turns: number;
  readonly isSelected: boolean;
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
  isSelected,
  isEditing,
  onClick,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: AgentRowProps) {
  const total = telemetry ? telemetry.inputTokens + telemetry.outputTokens : null;
  const titleParts = [
    `Agent ${run.ordinal + 1}`,
    `status: ${run.status}`,
    isSelected ? 'selected — chat shows this agent' : 'click to switch chat to this agent',
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
        'group rounded-md transition-colors',
        isEditing ? '' : 'cursor-pointer',
        isSelected ? 'bg-muted' : 'hover:bg-muted/60',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5" title={titleParts.join('\n')}>
        <span
          aria-hidden
          className={cn(
            'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
            AGENT_STATUS_TONE[run.status],
          )}
        />
        <span
          className={cn(
            'shrink-0 rounded py-0.5 text-center text-[9px] font-semibold uppercase leading-none tracking-wide',
            'w-[3.25rem]',
            AGENT_KIND_PALETTE[kind].bg,
            AGENT_KIND_PALETTE[kind].fg,
          )}
          aria-label={`agent kind: ${AGENT_KIND_PALETTE[kind].label}`}
          title={`agent ${run.ordinal + 1} — ${AGENT_KIND_PALETTE[kind].label}`}
        >
          {AGENT_KIND_PALETTE[kind].label}
        </span>
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
                cancel
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
                delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(true);
              }}
              className="invisible shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors group-hover:visible hover:text-danger"
              title="delete agent (double-click row to rename)"
              aria-label="delete agent"
            >
              <Trash2 size={11} aria-hidden />
            </button>
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
          <div className="flex flex-col gap-1 px-2 pb-1.5 pl-3.5">
            <div className="flex items-center gap-2 whitespace-nowrap text-2xs text-foreground/85">
              <span
                className="inline-flex items-baseline gap-1 tabular-nums"
                title={
                  aggregate
                    ? `in: ${aggregate.inputTokens.toLocaleString()} tokens (cumulative across providers)`
                    : 'no input tokens yet'
                }
              >
                <span aria-hidden className="text-muted-foreground/60">
                  ↓
                </span>
                {aggregate ? formatTokens(aggregate.inputTokens) : '0'}
              </span>
              <span
                className="inline-flex items-baseline gap-1 tabular-nums"
                title={
                  aggregate
                    ? `out: ${aggregate.outputTokens.toLocaleString()} tokens (cumulative across providers)`
                    : 'no output tokens yet'
                }
              >
                <span aria-hidden className="text-muted-foreground/60">
                  ↑
                </span>
                {aggregate ? formatTokens(aggregate.outputTokens) : '0'}
              </span>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <CostBadge
                value={aggregate?.estimatedCostUsd ?? 0}
                title={
                  aggregate
                    ? `$${aggregate.estimatedCostUsd.toFixed(4)} cumulative across providers`
                    : 'no cost yet'
                }
              />
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/70">
              {telemetry ? (
                <>
                  <span className="truncate">{shortModel(telemetry.model)}</span>
                  <span aria-hidden>·</span>
                </>
              ) : null}
              <span className="tabular-nums" title={`${turns} turn${turns === 1 ? '' : 's'}`}>
                {turns}t
              </span>
              <span aria-hidden>·</span>
              <AgentLifetime run={run} />
            </div>
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
  if (m < 60) return `${m}m ${diff % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function AgentLifetime({ run }: { run: Session }) {
  const [now, setNow] = useState(() => Date.now());
  const isLive = !!run.startedAt && !run.completedAt;
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [isLive]);

  if (!run.startedAt) {
    return (
      <span className="text-muted-foreground/60" title="agent spawned but has not run yet">
        not started
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
      {run.completedAt ? `⏱ ${ageStr}` : `⏱ ${ageStr} (live)`}
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
  const barTone =
    pct >= 0.9 ? 'bg-danger' : pct >= 0.75 ? 'bg-warning' : pct >= 0.5 ? 'bg-info' : 'bg-success';
  const iconTone =
    pct >= 0.9
      ? 'text-danger'
      : pct >= 0.75
        ? 'text-warning'
        : pct >= 0.5
          ? 'text-info'
          : 'text-success';
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
        workspaceSessions.map((s) => s.id as TaskId),
      );
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      title="delete all sessions?"
      description={`disconnecting "${workspaceName}" will permanently remove all ${workspaceSessions.length} session${workspaceSessions.length === 1 ? '' : 's'} listed below. worktrees, transcripts, and audit logs will be deleted. this cannot be undone.`}
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'deleting…' : 'delete all & disconnect'}
          </Button>
        </>
      }
    >
      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {workspaceSessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border-soft bg-subtle px-3 py-1.5 text-xs"
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
