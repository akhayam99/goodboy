import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea, cn } from '@kay-am/ui';
import { FolderOpen, FolderPlus, Plus } from 'lucide-react';
import type { ProviderId, Session, Workspace } from '@kay-am/types';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
} from '../store';
import { NewSessionDialog } from './NewSessionDialog';
import { OpenInEditorButton } from './OpenInEditorButton';
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

export function WorkspacesSidebar({ onOpenSettings }: WorkspacesSidebarProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);

  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="flex-1">
        <Section title="workspaces">
          <ul className="flex flex-col gap-0.5">
            {workspaces.map((ws) => (
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
        </Section>

        <div className="my-2 border-t border-border-soft" />

        <Section
          title="sessions"
          subtitle={currentWorkspace ? currentWorkspace.name : 'select a workspace'}
        >
          {!currentWorkspace ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              pick a workspace to see its sessions.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSession?.id}
                  onClick={() => void setCurrentSession(session.id)}
                />
              ))}
              <li>
                <AddRow
                  label="add session"
                  icon={<Plus size={13} aria-hidden />}
                  onClick={() => setNewSessionOpen(true)}
                />
              </li>
            </ul>
          )}
        </Section>
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
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <section className="flex flex-col px-2 pt-3">
      <header className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </span>
        {subtitle ? (
          <span className="line-clamp-1 text-[10px] text-muted-foreground/80">{subtitle}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

interface WorkspaceRowProps {
  workspace: Workspace;
  isActive: boolean;
  onClick: () => void;
}

function WorkspaceRow({ workspace, isActive, onClick }: WorkspaceRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/60',
        )}
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
    </li>
  );
}

interface SessionRowProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}

function SessionRow({ session, isActive, onClick }: SessionRowProps) {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id] ?? null);
  const providerId = session.providerPreference.defaultProvider;

  return (
    <li className="group">
      <div
        className={cn(
          'flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors',
          isActive ? 'bg-muted' : 'hover:bg-muted/60',
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-2 text-left text-sm"
        >
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              isActive ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
            aria-hidden
          />
          <span className="line-clamp-1 flex-1">{session.goal}</span>
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                'inline-flex items-center rounded-sm px-1 py-0.5 text-[10px] font-medium leading-none',
                PROVIDER_CHIP_COLOR[providerId],
              )}
              title={providerId}
            >
              {PROVIDER_SHORT[providerId]}
            </span>
            <StatusBadge state={session.state} />
          </div>
        </button>
        <div
          className={cn(
            'flex justify-end opacity-0 transition-opacity',
            (isActive || worktreePath !== null) && 'group-hover:opacity-100',
            isActive && 'opacity-100',
          )}
        >
          <OpenInEditorButton worktreePath={worktreePath} label="vscode" />
        </div>
      </div>
    </li>
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
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          the directory must contain a `.git` folder.
        </p>
      </div>
    </Dialog>
  );
}
