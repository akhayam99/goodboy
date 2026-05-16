import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea, cn } from '@kay-am/ui';
import {
  ArrowRight,
  ArrowUpDown,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  FolderPlus,
  Gauge,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
  HelpCircle,
  Loader2,
  MessagesSquare,
  Moon,
  Play,
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
  agentHasUnread,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionNextActions,
  useSessionLoading,
  useSessionPlans,
  useSessionSlots,
  useSessions,
  useTaskHasUnread,
  useWorkspaceHasUnread,
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
  shortModelWithVersion,
} from '../agent-row-format';
import { PROVIDER_CAPABILITIES, WORKFLOW_LIBRARY, type NextAction } from '@kay-am/core';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  type AgentKind,
  resolveAgentKind,
} from '../agent-kind';
import { AgentKindMenu } from './AgentKindMenu';
import { NextActionChips } from './NextActionChips';
import { spawnFromNextAction, spawnKindForAction } from '../spawn-from-next-action';
import { openUrl } from '../editor';
import { formatError } from '../errors';
import { useThemeStore } from '../theme';
import { STORAGE_KEYS } from '../storage-keys';
import { parseCap } from '../lib/parse-cap';

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

const HEADER_ICON_BTN =
  'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground' as const;

const PREVIEW_LIST_ITEM = 'rounded-md bg-subtle px-3 py-2 text-xs' as const;

const SECTION_LABEL =
  'flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground' as const;

type SessionSort = 'updated' | 'alpha';

export function WorkspacesSidebar({ onOpenSettings }: WorkspacesSidebarProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  // Adapter with the (id: TaskId) => void signature SessionList expects.
  // useCallback gives a stable ref so memoized SessionRow rows downstream
  // skip re-render on every parent paint.
  const onSelectSession = useCallback(
    (id: TaskId) => {
      void setCurrentSession(id);
    },
    [setCurrentSession],
  );
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
            className={HEADER_ICON_BTN}
          >
            {theme === 'dark' ? <Sun size={13} aria-hidden /> : <Moon size={13} aria-hidden />}
          </button>
          <NotificationCenter />
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            title="getting started — guide"
            aria-label="open getting started guide"
            className={HEADER_ICON_BTN}
          >
            <HelpCircle size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title="settings (⌘,)"
            aria-label="open settings"
            className={HEADER_ICON_BTN}
          >
            <Settings size={13} aria-hidden />
          </button>
        </div>
      </div>

      <ScrollArea className="max-h-[40%] shrink-0">
        <section className="flex flex-col px-2">
          <header className="flex items-center justify-between gap-2 pb-1.5">
            <span className={SECTION_LABEL}>
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
                label="Add workspace"
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
            <span className={SECTION_LABEL}>
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
                // Stable ref: setCurrentSession action is itself stable, but
                // we need the matching (id: TaskId) => void signature. The
                // action no-ops on same id internally.
                onSelectSession={onSelectSession}
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
  const workspaceHasUnread = useWorkspaceHasUnread(workspace.id);
  const showUnreadDot = workspaceHasUnread && !isActive;

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
            aria-hidden
            title={showUnreadDot ? 'unread agent response in this workspace' : undefined}
            className="relative inline-flex h-1.5 w-1.5 shrink-0"
          >
            {showUnreadDot && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-block h-1.5 w-1.5 rounded-full',
                showUnreadDot ? 'bg-warning' : isActive ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            />
          </span>
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
          title="workspace settings (incl. disconnect)"
          aria-label={`settings for workspace ${workspace.name}`}
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

  // Stable per-id closures so memoized SessionRow props don't get a fresh
  // function ref on every parent render. These maps only rebuild when the
  // session list itself or one of the upstream callbacks actually changes.
  const rowHandlers = useMemo(() => {
    const click = new Map<TaskId, () => void>();
    const arch = new Map<TaskId, () => void>();
    const unarch = new Map<TaskId, () => void>();
    const ids = new Set<TaskId>();
    for (const s of sortedActive) ids.add(s.id);
    for (const s of sortedArchived) ids.add(s.id);
    for (const id of ids) {
      click.set(id, () => onSelectSession(id));
      arch.set(id, () => onArchive(id));
      unarch.set(id, () => onUnarchive(id));
    }
    return { click, arch, unarch };
  }, [sortedActive, sortedArchived, onSelectSession, onArchive, onUnarchive]);

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
            onClick={rowHandlers.click.get(session.id)!}
            archived={false}
            onArchive={rowHandlers.arch.get(session.id)!}
            onUnarchive={rowHandlers.unarch.get(session.id)!}
          />
        ))}
        <li>
          <AddRow
            label="Add session"
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
                  onClick={rowHandlers.click.get(session.id)!}
                  archived
                  onArchive={rowHandlers.arch.get(session.id)!}
                  onUnarchive={rowHandlers.unarch.get(session.id)!}
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
        title={`sort: ${current.label}`}
        aria-label="sort sessions"
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
  // Stable refs so memoized SessionRow downstream doesn't invalidate.
  const archive = useCallback((id: TaskId) => {
    setMap((prev) => {
      const next = { ...prev, [id]: true as const };
      writeArchivedSet(next);
      return next;
    });
  }, []);
  const unarchive = useCallback((id: TaskId) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[id];
      writeArchivedSet(next);
      return next;
    });
  }, []);
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
  PullRequestStateKind,
  { icon: React.ElementType; label: string; className: string }
> = {
  draft: {
    icon: GitPullRequestDraft,
    label: 'draft',
    className: 'text-muted-foreground',
  },
  open: {
    icon: GitPullRequest,
    label: 'in review',
    className: 'text-success',
  },
  approved: {
    icon: GitPullRequestArrow,
    label: 'approved',
    className: 'text-success',
  },
  merged: {
    icon: GitMerge,
    label: 'merged',
    className: 'text-merged',
  },
  closed: {
    icon: GitPullRequestClosed,
    label: 'closed',
    className: 'text-danger',
  },
};

interface PrStatusIconProps {
  taskId: TaskId;
}

function PrStatusIcon({ taskId }: PrStatusIconProps) {
  const github = useAppStore((s) => s.sessionGithub[taskId]);
  const branch = useAppStore((s) => s.sessionBranches[taskId]);

  const isLoading = !github || github.loading || (github.fetchedAt === null && !github.error);

  if (isLoading) {
    return (
      <span
        title="loading PR status…"
        aria-label="loading PR status"
        className="shrink-0 rounded p-0.5 text-muted-foreground/50"
      >
        <Loader2 size={12} aria-hidden className="animate-spin" />
      </span>
    );
  }

  if (!branch || !github.pr) {
    return (
      <span
        title="no PR open"
        aria-label="no PR open"
        className="shrink-0 rounded p-0.5 text-danger/70"
      >
        <GitPullRequest size={12} aria-hidden />
      </span>
    );
  }

  const { pr } = github;
  const entry = PR_ICON_MAP[pr.state];
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

// Memoized so a session-switch click only re-renders the two rows whose
// `isActive` flips, not every row in the workspace. Handler refs come from
// SessionList via stable closures keyed by session.id, so default shallow
// compare is enough.
const SessionRow = memo(function SessionRow({
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

  const barColor = (() => {
    if (pct === null) return '';
    if (pct >= 1) return 'bg-danger';
    if (pct >= 0.8) return 'bg-warning';
    return 'bg-muted-foreground';
  })();

  const onCapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCapDraft(cap !== null ? String(cap) : '');
    setEditingCap(true);
  };

  const onCapSave = async () => {
    const parsed = parseCap(capDraft);
    if (parsed !== null) {
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
      setRenameError(formatError(err));
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

  const taskHasUnread = useTaskHasUnread(session.id as TaskId);
  const showUnreadDot = taskHasUnread && !isActive;

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
            aria-hidden
            title={showUnreadDot ? 'unread agent response' : undefined}
            className="relative inline-flex h-1.5 w-1.5 shrink-0"
          >
            {showUnreadDot && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-block h-1.5 w-1.5 rounded-full',
                showUnreadDot ? 'bg-warning' : isActive ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            />
          </span>
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
            {(() => {
              const hasWorkflow = !!session.workflowId;
              const tooltip = !hasWorkflow
                ? 'no workflow configured — auto-run unavailable'
                : session.autoRun
                  ? 'autorun on — click to pause'
                  : 'autorun off — click to enable';
              const ariaLabel = !hasWorkflow
                ? 'autorun unavailable'
                : session.autoRun
                  ? 'autorun on'
                  : 'autorun off';
              const cls = !hasWorkflow
                ? 'text-muted-foreground/25 cursor-not-allowed'
                : session.autoRun
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground';
              return (
                <button
                  type="button"
                  disabled={!hasWorkflow}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasWorkflow) return;
                    void setSessionAutoRun(session.id as TaskId, !session.autoRun);
                  }}
                  title={tooltip}
                  aria-label={ariaLabel}
                  className={cn('rounded p-0.5 transition-colors', cls)}
                >
                  {hasWorkflow && session.autoRun ? (
                    <Zap size={11} aria-hidden />
                  ) : (
                    <ZapOff size={11} aria-hidden />
                  )}
                </button>
              );
            })()}
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
});

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
      title="Delete session?"
      description={`"${sessionGoal}" will be permanently removed. worktree, transcripts, and audit logs will be deleted. this cannot be undone.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
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
  task: Task;
}

function AgentsSection({ task }: AgentsSectionProps) {
  const isTaskActive = useAppStore((s) => s.currentSessionId === task.id);
  const plansForTask = useSessionPlans(task.id);
  const latestPlan = plansForTask[plansForTask.length - 1];
  const hasActivePlan = !!latestPlan && latestPlan.status === 'active';
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
  const setAgentKind = useAppStore((s) => s.setAgentKind);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
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

  const onPickAgent = (sid: SessionId) => {
    if (sid === selectedAgentId) return;
    void selectAgent(task.id, sid);
  };

  const onSpawn = async (stepId: Step['id'] | null, model?: string) => {
    setSpawnError(null);
    try {
      await spawnAgent(task.id, stepId ? { stepId, ...(model !== undefined && { model }) } : {});
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const onRenameCommit = async (id: SessionId, name: string) => {
    setEditingId(null);
    try {
      await renameAgent(task.id, id, name);
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const onDeleteAgent = async (id: SessionId) => {
    try {
      await deleteAgent(task.id, id);
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  return (
    <section className="mt-8 flex flex-col px-2 pb-3">
      <header className="flex items-center justify-between gap-2 pb-1.5">
        <span className={SECTION_LABEL}>
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
        loading.agents ? (
          <ul role="status" aria-label="loading agents" className="flex flex-col gap-1 pl-2">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <span className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-2 text-xs text-muted-foreground/70">
            No agents yet — spawn one below.
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-1 pl-2">
          {sorted.map((run) => {
            const stepName = run.stepId
              ? (workflow?.steps.find((s) => s.id === run.stepId)?.name ?? null)
              : null;
            const kind = resolveAgentKind(
              stepName ?? run.name,
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
                onPickKind={(next) => setAgentKind(run.id, next)}
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
            consumesActivePlan={hasActivePlan}
          />
        </div>
      ) : null}
      {workflow && hasActivePlan ? null : <ActivePlanCta taskId={task.id} />}
      <NextActionChips
        taskId={task.id}
        workflowBound={task.workflowId !== undefined}
        className="mt-2 px-2"
      />
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
        Spawn agent
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

function ActivePlanCta({ taskId }: { taskId: TaskId }) {
  const plans = useSessionPlans(taskId);
  const runPlan = useAppStore((s) => s.runPlan);
  const abandonPlan = useAppStore((s) => s.abandonPlan);
  const [spawning, setSpawning] = useState(false);
  const latest = plans[plans.length - 1];
  if (!latest || latest.status !== 'active') return null;

  const handleTrigger = async () => {
    if (spawning) return;
    setSpawning(true);
    try {
      await runPlan(taskId, latest.id);
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
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10',
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
          onClick={() => void abandonPlan(taskId, latest.id)}
          className="rounded-md border border-border-soft px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title="mark plan as superseded; next plan emitted starts a new logical plan"
        >
          abandon
        </button>
      </div>
    </div>
  );
}

function SuggestionMenuItem({ action, onSelect }: { action: NextAction; onSelect: () => void }) {
  const kind = spawnKindForAction(action);
  const palette = AGENT_KIND_PALETTE[kind];
  const defaults = AGENT_KIND_DEFAULTS[kind];
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      title={`${defaults.model} · ${defaults.effort} effort`}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors',
        `${palette.bg} ${palette.fg} hover:opacity-90`,
      )}
    >
      <span className="flex items-center gap-1.5">
        <ArrowRight size={11} aria-hidden />
        <span className="font-medium">{action.label}</span>
      </span>
      <span className="text-2xs opacity-70">{shortModel(defaults.model)}</span>
    </button>
  );
}

const AGENT_STATUS_TONE: Record<SessionStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-info',
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
  readonly turnsLoading: boolean;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isEditing: boolean;
  readonly onClick: () => void;
  readonly onPickKind: (next: AgentKind) => void;
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
  onPickKind,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: AgentRowProps) {
  const total = telemetry ? telemetry.inputTokens + telemetry.outputTokens : null;
  const titleParts = [
    `agent ${run.ordinal + 1}`,
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
        agentHasUnread(run, isSelected && isTaskActive) && 'ring-1 ring-inset ring-warning/70',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5" title={titleParts.join('\n')}>
        <AgentKindMenu kind={kind} agentLabel={`agent ${run.ordinal + 1}`} onPick={onPickKind} />
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
            <div className="flex items-center justify-between gap-2 whitespace-nowrap text-2xs text-muted-foreground/85">
              <span
                className="min-w-0 truncate text-muted-foreground/70"
                title={telemetry?.model ?? undefined}
              >
                {telemetry ? shortModelWithVersion(telemetry.model) : '—'}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className="inline-flex items-baseline gap-0.5 tabular-nums"
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
                  className="inline-flex items-baseline gap-0.5 tabular-nums"
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
                {turnsLoading ? (
                  <span
                    aria-label="loading turn count"
                    className="inline-block h-2.5 w-4 animate-pulse rounded bg-muted"
                  />
                ) : (
                  <span className="tabular-nums" title={`${turns} turn${turns === 1 ? '' : 's'}`}>
                    {turns}t
                  </span>
                )}
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
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
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
        workspaceSessions.map((s) => s.id as TaskId),
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
