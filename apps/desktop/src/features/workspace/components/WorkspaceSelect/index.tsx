import { useEffect, useState } from 'react';
import { FolderOpen, Plus, Unplug, X } from 'lucide-react';
import { Button, Dialog, cn } from '@kay-am/ui';
import type { SessionId, Workspace, WorkspaceId } from '@kay-am/types';
import { MAX_WORKSPACES } from '../../../../shared/lib/features';
import { formatError } from '../../../../shared/lib/errors';
import {
  useAppStore,
  useCurrentWorkspace,
  useSessions,
  useWorkspaceHasUnread,
  useWorkspaces,
} from '../../../../store';

interface WorkspaceSelectProps {
  onAddWorkspace: () => void;
}

interface DisconnectTarget {
  readonly id: WorkspaceId;
  readonly name: string;
}

export function WorkspaceSelect({ onAddWorkspace }: WorkspaceSelectProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const [disconnectTarget, setDisconnectTarget] = useState<DisconnectTarget | null>(null);

  const sorted = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  const atCap = workspaces.length >= MAX_WORKSPACES;

  const onRequestDisconnect = async (target: DisconnectTarget) => {
    // sessions are only hydrated for the current workspace, so switch first
    // to make sure bulk-delete + disconnect operate on real data.
    if (currentWorkspace?.id !== target.id) {
      await setCurrentWorkspace(target.id);
    }
    setDisconnectTarget(target);
  };

  return (
    <div className="shrink-0 px-2 py-1.5">
      <span className="mb-1 flex items-center gap-1.5 px-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <FolderOpen size={11} aria-hidden className="text-primary" />
        Workspaces
        <span
          className={cn(
            'ml-auto font-mono text-[10px] tracking-normal',
            atCap ? 'text-warning' : 'text-muted-foreground/60',
          )}
          title={`up to ${MAX_WORKSPACES} workspaces during beta`}
        >
          {workspaces.length}/{MAX_WORKSPACES}
        </span>
      </span>
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {sorted.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            isActive={ws.id === currentWorkspace?.id}
            onSelect={() => void setCurrentWorkspace(ws.id)}
            onDisconnect={() => void onRequestDisconnect({ id: ws.id, name: ws.name })}
          />
        ))}
        <button
          type="button"
          onClick={onAddWorkspace}
          disabled={atCap}
          className={cn(
            'flex shrink-0 items-center justify-center rounded border border-dashed px-2 py-1.5 transition-colors',
            atCap
              ? 'cursor-not-allowed border-border-soft/60 text-muted-foreground/30'
              : 'border-border-soft text-muted-foreground/60 hover:border-border hover:bg-muted/50 hover:text-muted-foreground',
          )}
          title={
            atCap
              ? `max ${MAX_WORKSPACES} workspaces — disconnect one to add another`
              : 'add workspace'
          }
          aria-label={atCap ? `workspace limit reached (${MAX_WORKSPACES})` : 'add workspace'}
        >
          <Plus size={12} aria-hidden />
        </button>
      </div>
      {disconnectTarget ? (
        <DisconnectWorkspaceDialog
          workspaceId={disconnectTarget.id}
          workspaceName={disconnectTarget.name}
          open
          onClose={() => setDisconnectTarget(null)}
        />
      ) : null}
    </div>
  );
}

function WorkspaceCard({
  workspace,
  isActive,
  onSelect,
  onDisconnect,
}: {
  workspace: Workspace;
  isActive: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  const hasUnread = useWorkspaceHasUnread(workspace.id);

  return (
    <div
      className={cn(
        'group relative flex shrink-0 items-center rounded border text-xs font-medium transition-colors',
        isActive
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border-soft bg-subtle text-muted-foreground hover:border-border hover:bg-muted/50',
      )}
      title={workspace.name}
    >
      {hasUnread && !isActive && (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-block h-2 w-2 rounded-full bg-warning" />
        </span>
      )}
      <button type="button" onClick={onSelect} className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="max-w-[100px] truncate">{workspace.name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDisconnect();
        }}
        className="flex h-full items-center pr-1.5 pl-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
        title={`disconnect "${workspace.name}"`}
        aria-label={`disconnect workspace ${workspace.name}`}
      >
        <X size={11} aria-hidden />
      </button>
    </div>
  );
}

interface DisconnectWorkspaceDialogProps {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
}

function DisconnectWorkspaceDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
}: DisconnectWorkspaceDialogProps) {
  const sessions = useSessions();
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const bulkDelete = useAppStore((s) => s.bulkDeleteSessionsForWorkspace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsSessions = sessions.filter((s) => s.workspaceId === workspaceId);
  const count = wsSessions.length;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (count > 0) {
        await bulkDelete(
          workspaceId,
          wsSessions.map((s) => s.id as SessionId),
        );
      } else {
        await deleteWorkspace(workspaceId);
      }
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Disconnect "${workspaceName}"?`}
      description={
        count > 0
          ? `this will permanently delete ${count} session${count === 1 ? '' : 's'} (worktrees, transcripts, audit logs) and unlink the workspace. the repository on disk stays untouched.`
          : 'removes kAY.am state for this workspace and unlinks it. the repository on disk stays untouched. you can re-add it later.'
      }
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            <Unplug size={13} aria-hidden className="mr-1.5" />
            {busy
              ? 'Disconnecting…'
              : count > 0
                ? `Delete ${count} & disconnect`
                : 'Confirm disconnect'}
          </Button>
        </>
      }
    >
      {count > 0 ? (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {wsSessions.map((s) => (
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
      ) : null}
    </Dialog>
  );
}
