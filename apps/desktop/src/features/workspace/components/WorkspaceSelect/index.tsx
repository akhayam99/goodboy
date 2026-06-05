import { useEffect, useState } from 'react';
import { FolderOpen, Plus, Settings } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Workspace, WorkspaceId } from '@goodboy/types';
import { MAX_WORKSPACES } from '../../../../shared/lib/features';
import { WorkspaceSettingsDialog } from '../WorkspaceSettingsDialog';
import {
  useAppStore,
  useCurrentWorkspace,
  useWorkspaceHasUnread,
  useWorkspaces,
} from '../../../../store';

interface Props {
  onAddWorkspace: () => void;
}

interface WorkspaceTarget {
  readonly id: WorkspaceId;
  readonly name: string;
}

export function WorkspaceSelect({ onAddWorkspace }: Props) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const requestWorkspaceSwitch = useAppStore((s) => s.requestWorkspaceSwitch);
  // Two pieces of state instead of one nullable target so the dialog can
  // stay mounted across opens. Mount-on-first-click was racing with the
  // <dialog>.showModal() effect under React 19 strict mode and silently
  // dropping the open call.
  const [settingsTarget, setSettingsTarget] = useState<WorkspaceTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);

  const openSettings = (target: WorkspaceTarget) => {
    setSettingsTarget(target);
    setSettingsSection(undefined);
    setSettingsOpen(true);
  };

  // Deep-link into per-workspace settings from elsewhere (e.g. the command
  // palette selecting a workflow or script). Always targets the current
  // workspace, the palette only lists the current workspace's items.
  useEffect(() => {
    const handler = (e: Event) => {
      if (!currentWorkspace) return;
      const detail = (e as CustomEvent<{ section?: string }>).detail;
      setSettingsTarget({ id: currentWorkspace.id, name: currentWorkspace.name });
      setSettingsSection(detail?.section);
      setSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-workspace-settings', handler);
    return () => window.removeEventListener('goodboy:open-workspace-settings', handler);
  }, [currentWorkspace]);

  const sorted = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  const atCap = workspaces.length >= MAX_WORKSPACES;

  return (
    <div className="shrink-0 px-3 py-3" data-tauri-drag-region="false">
      <span className="mb-2 flex items-center gap-1.5 px-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
            onSelect={() => void requestWorkspaceSwitch(ws.id)}
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
              ? `max ${MAX_WORKSPACES} workspaces, disconnect one to add another`
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
          initialSection={settingsSection}
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

  const showUnread = hasUnread && !isActive;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center rounded border text-xs font-medium transition-colors',
        isActive
          ? 'border-primary bg-primary/5 text-foreground'
          : showUnread
            ? 'animate-soft-pulse border-warning/70 bg-warning/5 text-foreground hover:bg-warning/10'
            : 'border-border-soft bg-subtle text-muted-foreground hover:border-border hover:bg-muted/50',
      )}
      title={showUnread ? `${workspace.name}, new activity` : workspace.name}
      data-tauri-drag-region="false"
    >
      <button
        type="button"
        onClick={onSelect}
        data-tauri-drag-region="false"
        className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-1"
      >
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
        title={`workspace settings, ${workspace.name}`}
        aria-label={`open workspace settings for ${workspace.name}`}
      >
        <Settings size={11} aria-hidden />
      </button>
    </div>
  );
}
