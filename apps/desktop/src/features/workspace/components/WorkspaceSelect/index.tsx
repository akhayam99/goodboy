import { useState } from 'react';
import { FolderOpen, Plus, Settings } from 'lucide-react';
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

interface WorkspaceTarget {
  readonly id: WorkspaceId;
  readonly name: string;
}

export function WorkspaceSelect({ onAddWorkspace }: WorkspaceSelectProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  // Two pieces of state instead of one nullable target so the dialog can
  // stay mounted across opens. Mount-on-first-click was racing with the
  // <dialog>.showModal() effect under React 19 strict mode and silently
  // dropping the open call.
  const [settingsTarget, setSettingsTarget] = useState<WorkspaceTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = (target: WorkspaceTarget) => {
    setSettingsTarget(target);
    setSettingsOpen(true);
  };

  const sorted = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  const atCap = workspaces.length >= MAX_WORKSPACES;

  return (
    <div className="shrink-0 px-2 py-1.5" data-tauri-drag-region="false">
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
      <div
        className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]"
        data-tauri-drag-region="false"
      >
        {sorted.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            isActive={ws.id === currentWorkspace?.id}
            onSelect={() => void setCurrentWorkspace(ws.id)}
            onOpenSettings={() => openSettings({ id: ws.id, name: ws.name })}
          />
        ))}
        <button
          type="button"
          onClick={onAddWorkspace}
          disabled={atCap}
          data-tauri-drag-region="false"
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
      {settingsTarget ? (
        <WorkspaceSettingsDialog
          workspaceId={settingsTarget.id}
          workspaceName={settingsTarget.name}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}

function WorkspaceCard({
  workspace,
  isActive,
  onSelect,
  onOpenSettings,
}: {
  workspace: Workspace;
  isActive: boolean;
  onSelect: () => void;
  onOpenSettings: () => void;
}) {
  const hasUnread = useWorkspaceHasUnread(workspace.id);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center rounded border text-xs font-medium transition-colors',
        isActive
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border-soft bg-subtle text-muted-foreground hover:border-border hover:bg-muted/50',
      )}
      title={workspace.name}
      data-tauri-drag-region="false"
    >
      <button
        type="button"
        onClick={onSelect}
        data-tauri-drag-region="false"
        className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-1"
      >
        {hasUnread && !isActive && (
          <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
            <span className="relative inline-block h-2 w-2 rounded-full bg-warning" />
          </span>
        )}
        <span className="max-w-[100px] truncate">{workspace.name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSettings();
        }}
        data-tauri-drag-region="false"
        className="flex h-full items-center px-1.5 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:text-foreground"
        title={`workspace settings — ${workspace.name}`}
        aria-label={`open workspace settings for ${workspace.name}`}
      >
        <Settings size={11} aria-hidden />
      </button>
    </div>
  );
}
