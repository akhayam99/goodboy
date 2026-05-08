import { useEffect, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea, cn } from '@kay-am/ui';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';
import type { ProviderId, Session, SessionId, SessionState, Workspace } from '@kay-am/types';
import {
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
  anthropic: 'bg-orange-100 text-orange-700',
  cursor: 'bg-blue-100 text-blue-700',
  codex: 'bg-green-100 text-green-700',
};

const PROVIDER_SHORT: Record<ProviderId, string> = {
  anthropic: 'cl',
  cursor: 'cu',
  codex: 'cx',
};

const STATE_FILTER_OPTIONS: ReadonlyArray<SessionState['kind']> = [
  'idle',
  'running',
  'ended',
  'error',
];

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
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (currentWorkspace) {
      setExpandedWorkspaces((prev) => new Set([...prev, currentWorkspace.id]));
    }
  }, [currentWorkspace]);

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(sidebarWorkspaceSearch.toLowerCase()),
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

  const toggleWorkspaceExpanded = (wsId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) {
        next.delete(wsId);
      } else {
        next.add(wsId);
      }
      return next;
    });
  };

  const providerFilterOptions: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

  const toggleStateFilter = (kind: SessionState['kind']) => {
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
      <div className="flex flex-col gap-1 px-2 pt-2">
        <SearchInput
          value={sidebarWorkspaceSearch}
          onChange={setSidebarWorkspaceSearch}
          placeholder="search workspaces…"
        />
      </div>

      <ScrollArea className="flex-1">
        <section className="flex flex-col px-2 pt-2">
          <header className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              workspaces
            </span>
          </header>
          <ul className="flex flex-col gap-0.5">
            {filteredWorkspaces.map((ws) => {
              const isActive = ws.id === currentWorkspace?.id;
              const isExpanded = expandedWorkspaces.has(ws.id);
              const wsSessions = filteredSessions.filter((s) => s.workspaceId === ws.id);

              return (
                <WorkspaceRow
                  key={ws.id}
                  workspace={ws}
                  isActive={isActive}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleWorkspaceExpanded(ws.id)}
                  onClick={() => void setCurrentWorkspace(ws.id)}
                  onDelete={() => setWorkspaceToDelete(ws)}
                  sessionList={
                    isExpanded ? (
                      <SessionList
                        sessions={wsSessions}
                        currentSessionId={currentSession?.id ?? null}
                        workspaceId={ws.id}
                        sidebarSessionSearch={
                          ws.id === currentWorkspace?.id ? sidebarSessionSearch : ''
                        }
                        onSessionSearch={
                          ws.id === currentWorkspace?.id ? setSidebarSessionSearch : () => undefined
                        }
                        stateFilter={sidebarStateFilter}
                        providerFilter={sidebarProviderFilter}
                        stateFilterOptions={STATE_FILTER_OPTIONS}
                        providerFilterOptions={providerFilterOptions}
                        onToggleState={toggleStateFilter}
                        onToggleProvider={toggleProviderFilter}
                        onSelectSession={(id) => void setCurrentSession(id)}
                        onNewSession={() => setNewSessionOpen(true)}
                      />
                    ) : null
                  }
                />
              );
            })}
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
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  onDelete: () => void;
  sessionList: React.ReactNode;
}

function WorkspaceRow({
  workspace,
  isActive,
  isExpanded,
  onToggleExpand,
  onClick,
  onDelete,
  sessionList,
}: WorkspaceRowProps) {
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
          onClick={() => {
            onClick();
            onToggleExpand();
          }}
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
          {isExpanded ? (
            <ChevronDown size={11} className="shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight size={11} className="shrink-0 text-muted-foreground" aria-hidden />
          )}
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
      {sessionList}
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
  sessions: ReadonlyArray<Session>;
  currentSessionId: SessionId | null;
  workspaceId: string;
  sidebarSessionSearch: string;
  onSessionSearch: (v: string) => void;
  stateFilter: ReadonlyArray<SessionState['kind']>;
  providerFilter: ReadonlyArray<ProviderId>;
  stateFilterOptions: ReadonlyArray<SessionState['kind']>;
  providerFilterOptions: ReadonlyArray<ProviderId>;
  onToggleState: (kind: SessionState['kind']) => void;
  onToggleProvider: (provider: ProviderId) => void;
  onSelectSession: (id: SessionId) => void;
  onNewSession: () => void;
}

function SessionList({
  sessions,
  currentSessionId,
  sidebarSessionSearch,
  onSessionSearch,
  stateFilter,
  providerFilter,
  stateFilterOptions,
  providerFilterOptions,
  onToggleState,
  onToggleProvider,
  onSelectSession,
  onNewSession,
}: SessionListProps) {
  return (
    <div className="ml-3 mt-0.5 flex flex-col gap-1 border-l border-border-soft pl-2">
      <SearchInput
        value={sidebarSessionSearch}
        onChange={onSessionSearch}
        placeholder="search sessions…"
      />

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

      <div className="flex flex-wrap gap-0.5">
        {stateFilterOptions.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onToggleState(kind)}
            className={cn(
              'rounded px-1 py-0.5 text-2xs font-medium uppercase tracking-wide transition-colors',
              stateFilter.includes(kind)
                ? 'bg-primary/15 text-primary'
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
                ? cn(PROVIDER_CHIP_COLOR[p])
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {PROVIDER_SHORT[p]}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-0.5">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isActive={session.id === currentSessionId}
            onClick={() => onSelectSession(session.id)}
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
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-2xs text-primary">
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
  session: Session;
  isActive: boolean;
  onClick: () => void;
}

function SessionRow({ session, isActive, onClick }: SessionRowProps) {
  const worktreePath = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const providerId = session.providerPreference.defaultProvider;
  const budget = useAppStore((s) => s.sessionBudgets[session.id as SessionId] ?? null);
  const spentUsd = useAppStore((s) => s.sessionSummary?.estimatedCostUsd ?? null);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const renameSession = useAppStore((s) => s.renameSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
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
      void loadSessionBudget(session.id as SessionId);
    }
  }, [session.id, loadSessionBudget]);

  const spent = isActive ? (spentUsd ?? 0) : 0;
  const cap = budget?.softCapUsd ?? null;
  const pct = cap !== null && cap > 0 ? spent / cap : null;

  const barColor =
    pct === null ? '' : pct >= 1 ? 'bg-red-500' : pct >= 0.8 ? 'bg-yellow-400' : 'bg-green-500';

  const onCapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCapDraft(cap !== null ? String(cap) : '');
    setEditingCap(true);
  };

  const onCapSave = async () => {
    const parsed = parseFloat(capDraft);
    if (!isNaN(parsed) && parsed > 0) {
      await setSessionBudget(session.id as SessionId, parsed);
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
      await renameSession(session.id as SessionId, renameDraft.trim());
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
    await deleteSession(session.id as SessionId);
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              title="delete session"
              aria-label="delete session"
            >
              <Trash2 size={11} />
            </button>
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
