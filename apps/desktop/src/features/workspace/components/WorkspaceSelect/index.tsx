import { Plus } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { Workspace } from '@kay-am/types';
import {
  useAppStore,
  useCurrentWorkspace,
  useWorkspaceHasUnread,
  useWorkspaces,
} from '../../../../store';

interface WorkspaceSelectProps {
  onAddWorkspace: () => void;
}

export function WorkspaceSelect({ onAddWorkspace }: WorkspaceSelectProps) {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);

  const sorted = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="shrink-0 px-2 py-1.5">
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {sorted.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            isActive={ws.id === currentWorkspace?.id}
            onSelect={() => void setCurrentWorkspace(ws.id)}
          />
        ))}
        <button
          type="button"
          onClick={onAddWorkspace}
          className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-border-soft px-2 py-1.5 text-muted-foreground/60 transition-colors hover:border-border hover:bg-muted/50 hover:text-muted-foreground"
          title="add workspace"
          aria-label="add workspace"
        >
          <Plus size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  isActive,
  onSelect,
}: {
  workspace: Workspace;
  isActive: boolean;
  onSelect: () => void;
}) {
  const hasUnread = useWorkspaceHasUnread(workspace.id);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        isActive
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border-soft bg-subtle text-muted-foreground hover:border-border hover:bg-muted/50',
      )}
      title={workspace.name}
    >
      {hasUnread && !isActive && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-block h-2 w-2 rounded-full bg-warning" />
        </span>
      )}
      <span className="max-w-[100px] truncate">{workspace.name}</span>
    </button>
  );
}
