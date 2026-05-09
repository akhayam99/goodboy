import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea, cn } from '@kay-am/ui';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';
import type {
  ProviderId,
  Session,
  SessionStatus,
  Task,
  TaskId,
  TurnState,
  Workspace,
} from '@kay-am/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
} from '../store';
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog';
import { NewSessionDialog } from './NewSessionDialog';
import { StatusBadge } from './StatusBadge';

interface WorkspacesSidebarProps {
  onOpenSettings: () => void;
}

const PROVIDER_CHIP_COLOR: Record<ProviderId, string> = {
  anthropic: 'bg-muted text-foreground',
  cursor: 'bg-muted text-foreground',
  codex: 'bg-muted text-foreground',
};

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

export function WorkspacesSidebar({ onOpenSettings }: WorkspacesSidebarProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);

  const sidebarWorkspaceSearch = useAppStore((s) => s.sidebarWorkspaceSearch);
  const sidebarSessionSearch = useAppStore((s) => s.sidebarSessionSearch);
  const sidebarStateFilter = useAppStore((s) => s.sidebarStateFilter);
  const sidebarProviderFilter = useAppStore((s) => s.sidebarProviderFilter);
  const setSidebarWorkspaceSearch = useAppStore((s) => s.setSidebarWorkspaceSearch);
  const setSidebarSessionSearch = useAppStore((s) => s.setSidebarSessionSearch);
  const setSidebarStateFilter = useAppStore((s) => s.setSidebarStateFilter);
  const setSidebarProviderFilter = useAppStore((s) => s.setSidebarProviderFilter);

  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  const filteredWorkspaces = useMemo(
    () =>
      [...workspaces]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((ws) => ws.name.toLowerCase().includes(sidebarWorkspaceSearch.toLowerCase())),
    [workspaces, sidebarWorkspaceSearch],
  );

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.goal.toLowerCase().includes(sidebarSessionSearch.toLowerCase());
    const matchesState =
      sidebarStateFilter.length === 0 || sidebarStateFilter.includes(s.state.kind);
    const matchesProvider =
      sidebarProviderFilter.length === 0 ||
      sidebarProviderFilter.includes(s.providerPreference.defaultProvider);
    return matchesSearch && matchesState && matchesProvider;
  });

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
      <ScrollArea className="max-h-[40%] shrink-0">
        <section className="flex flex-col px-2 pb-4 pt-3">
          <header className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              workspaces
            </span>
          </header>
          <SearchInput
            value={sidebarWorkspaceSearch}
            onChange={setSidebarWorkspaceSearch}
            placeholder="search workspaces…"
          />
          <ul className="mt-1 flex flex-col gap-0.5">
            {filteredWorkspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isActive={ws.id === currentWorkspace?.id}
                onClick={() => void setCurrentWorkspace(ws.id)}
                onDelete={() => setWorkspaceToDelete(ws)}
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

      <div className="my-1 border-t border-border" aria-hidden />

      <ScrollArea className="flex-1">
        <section className="flex flex-col px-2 pt-4">
          <header className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              sessions
            </span>
            {currentWorkspace ? (
              <span className="truncate text-2xs text-muted-foreground/70">
                {currentWorkspace.name}
              </span>
            ) : null}
          </header>
          {currentWorkspace ? (
            <SessionList
              activeSessions={activeSessions}
              archivedSessions={archivedSessions}
              currentSessionId={currentSession?.id ?? null}
              sessionSearch={sidebarSessionSearch}
              onSessionSearch={setSidebarSessionSearch}
              stateFilter={sidebarStateFilter}
              providerFilter={sidebarProviderFilter}
              stateFilterOptions={STATE_FILTER_OPTIONS}
              providerFilterOptions={PROVIDER_FILTER_OPTIONS}
              onToggleState={toggleStateFilter}
              onToggleProvider={toggleProviderFilter}
              onSelectSession={(id) => void setCurrentSession(id)}
              onNewSession={() => setNewSessionOpen(true)}
              onArchive={archive}
              onUnarchive={unarchive}
            />
          ) : (
            <p className="px-1 py-2 text-xs text-muted-foreground/70">
              select a workspace to see its sessions.
            </p>
          )}
        </section>

        {currentSession ? <AgentsSection task={currentSession} /> : null}
      </ScrollArea>

      <AddWorkspaceDialog open={addWorkspaceOpen} onClose={() => setAddWorkspaceOpen(false)} />
      {currentWorkspace ? (
        <NewSessionDialog
          open={newSessionOpen}
          onClose={() => setNewSessionOpen(false)}
          workspaceId={currentWorkspace.id}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
      {workspaceToDelete ? (
        <DeleteWorkspaceDialog
          workspace={workspaceToDelete}
          open={workspaceToDelete !== null}
          onClose={() => setWorkspaceToDelete(null)}
        />
      ) : null}
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="relative flex items-center">
      <Search
        size={11}
        className="pointer-events-none absolute left-2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border-soft bg-muted/40 py-1 pl-6 pr-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 text-muted-foreground hover:text-foreground"
          aria-label="clear search"
        >
          <X size={11} />
        </button>
      ) : null}
    </div>
  );
}

interface WorkspaceRowProps {
  workspace: Workspace;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function WorkspaceRow({ workspace, isActive, onClick, onDelete }: WorkspaceRowProps) {
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
          className="invisible mr-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors group-hover:visible hover:!text-foreground"
          title="workspace settings"
          aria-label={`settings for workspace ${workspace.name}`}
        >
          <Settings2 size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="invisible mr-1 shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors group-hover:visible hover:!text-danger"
          title="delete workspace"
          aria-label={`delete workspace ${workspace.name}`}
        >
          <Trash2 size={12} aria-hidden />
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
  sessionSearch: string;
  onSessionSearch: (v: string) => void;
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

type SessionSort = 'updated' | 'alpha';

function SessionList({
  activeSessions,
  archivedSessions,
  currentSessionId,
  sessionSearch,
  onSessionSearch,
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
  const [sort, setSort] = useState<SessionSort>('updated');
  const [archivedOpen, setArchivedOpen] = useState(false);

  const sortedActive = useMemo(() => sortSessions(activeSessions, sort), [activeSessions, sort]);
  const sortedArchived = useMemo(
    () => sortSessions(archivedSessions, sort),
    [archivedSessions, sort],
  );
  return (
    <div className="flex flex-col gap-1">
      <SearchInput
        value={sessionSearch}
        onChange={onSessionSearch}
        placeholder="search sessions…"
      />

      <div className="flex items-center justify-between">
        <SortToggle sort={sort} onChange={setSort} />
        {(stateFilter.length > 0 || providerFilter.length > 0) && (
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
        )}
      </div>

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

function SortToggle({ sort, onChange }: { sort: SessionSort; onChange: (s: SessionSort) => void }) {
  return (
    <div className="flex items-center gap-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
      <span>sort</span>
      <button
        type="button"
        onClick={() => onChange('updated')}
        className={cn(
          'rounded px-1.5 py-0.5 transition-colors',
          sort === 'updated' ? 'bg-foreground text-background' : 'hover:text-foreground',
        )}
      >
        recent
      </button>
      <button
        type="button"
        onClick={() => onChange('alpha')}
        className={cn(
          'rounded px-1.5 py-0.5 transition-colors',
          sort === 'alpha' ? 'bg-foreground text-background' : 'hover:text-foreground',
        )}
      >
        a-z
      </button>
    </div>
  );
}

function sortSessions(list: ReadonlyArray<Task>, sort: SessionSort): ReadonlyArray<Task> {
  const copy = [...list];
  if (sort === 'alpha') copy.sort((a, b) => a.goal.localeCompare(b.goal));
  else copy.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return copy;
}

const ARCHIVED_KEY = 'kayam:archived-tasks';

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
        <X size={9} />
      </button>
    </span>
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
  const providerId = session.providerPreference.defaultProvider;
  const budget = useAppStore((s) => s.sessionBudgets[session.id as TaskId] ?? null);
  const spentUsd = useAppStore((s) => s.sessionSummary?.estimatedCostUsd ?? null);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const renameTask = useAppStore((s) => s.renameTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const budgetLoaded = useRef(false);

  const [editingCap, setEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        <div className="flex w-full items-center gap-2 text-sm">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              isActive ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
            aria-hidden
          />
          {renaming ? (
            <div className="flex flex-1 flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
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
            <span className="line-clamp-1 flex-1">{session.goal}</span>
          )}
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <span
              className={cn(
                'inline-flex items-center rounded-sm px-1 py-0.5 text-2xs font-medium leading-none',
                PROVIDER_CHIP_COLOR[providerId],
              )}
              title={providerId}
            >
              {PROVIDER_SHORT[providerId]}
            </span>
            <StatusBadge state={session.state} />
            <SessionRowMenu
              archived={archived}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={() => setConfirmDelete(true)}
              onRename={() => {
                setRenameDraft(session.goal);
                setRenameError(null);
                setRenaming(true);
              }}
            />
          </div>
        </div>

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
    </li>
  );
}

interface DeleteConfirmDialogProps {
  sessionGoal: string;
  onConfirm: (e: React.MouseEvent) => void;
  onCancel: () => void;
}

interface SessionRowMenuProps {
  archived: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function SessionRowMenu({
  archived,
  onArchive,
  onUnarchive,
  onDelete,
  onRename,
}: SessionRowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const choose = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        title="session menu"
        aria-label="session menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={12} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-5 z-20 min-w-[8.5rem] overflow-hidden rounded-md bg-background py-1 text-xs shadow-lg ring-1 ring-border-soft"
        >
          <MenuItem onClick={choose(onRename)}>
            <span className="flex items-center gap-2">rename</span>
          </MenuItem>
          {archived ? (
            <MenuItem onClick={choose(onUnarchive)}>
              <span className="flex items-center gap-2">
                <ArchiveRestore size={11} aria-hidden /> unarchive
              </span>
            </MenuItem>
          ) : (
            <MenuItem onClick={choose(onArchive)}>
              <span className="flex items-center gap-2">
                <Archive size={11} aria-hidden /> archive
              </span>
            </MenuItem>
          )}
          <MenuItem onClick={choose(onDelete)} danger>
            <span className="flex items-center gap-2">
              <Trash2 size={11} aria-hidden /> delete
            </span>
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
        danger ? 'text-danger' : 'text-foreground',
      )}
    >
      {children}
    </button>
  );
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

  const reset = () => {
    setPath('');
    setError(null);
    setBusy(false);
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
      description="point at a git repository on disk. each session creates its own worktree."
      size="md"
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
    </Dialog>
  );
}

interface AgentsSectionProps {
  task: Task;
}

function AgentsSection({ task }: AgentsSectionProps) {
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Session>),
  );

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);

  return (
    <section className="flex flex-col px-2 pb-3 pt-4">
      <header className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          agents
        </span>
        <span className="truncate text-2xs text-muted-foreground/70">
          {sorted.length === 0 ? 'none yet' : `${sorted.length} for this task`}
        </span>
      </header>
      {sorted.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground/70">
          no agents yet — start a workflow to spawn the first one.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {sorted.map((run) => (
            <AgentRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

const AGENT_STATUS_TONE: Record<SessionStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-muted-foreground/20',
};

function AgentRow({ run }: { run: Session }) {
  return (
    <li
      className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs"
      title={`step #${run.ordinal + 1} · ${run.status}`}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
          AGENT_STATUS_TONE[run.status],
        )}
      />
      <span className="line-clamp-1 flex-1 text-foreground">{run.name}</span>
      <span className="shrink-0 font-mono text-2xs text-muted-foreground">{run.ordinal + 1}</span>
    </li>
  );
}
