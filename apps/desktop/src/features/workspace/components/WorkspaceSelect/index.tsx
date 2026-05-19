import { useState } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { Workspace, WorkspaceId } from '@kay-am/types';
import { MAX_WORKSPACES } from '../../../../shared/lib/features';
import { WorkspaceSettingsDialog } from '../WorkspaceSettingsDialog';
import {
  useAppStore,
  useCurrentWorkspace,
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
            onDisconnect={() => setDisconnectTarget({ id: ws.id, name: ws.name })}
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
        <WorkspaceSettingsDialog
          workspaceId={disconnectTarget.id}
          workspaceName={disconnectTarget.name}
          open
          onClose={() => setDisconnectTarget(null)}
          initialSection="danger"
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
