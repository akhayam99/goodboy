import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderOpen, FolderPlus } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const sorted = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative shrink-0 px-2 py-1.5" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors',
          open
            ? 'border-primary/40 bg-muted/80'
            : 'border-border-soft bg-subtle/50 hover:border-border hover:bg-muted/50',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FolderOpen
          size={14}
          aria-hidden
          className={cn('shrink-0', currentWorkspace ? 'text-primary' : 'text-muted-foreground')}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {currentWorkspace?.name ?? 'Select workspace'}
        </span>
        <ChevronDown
          size={13}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-2 right-2 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg bg-background py-1 shadow-lg ring-1 ring-border-soft"
        >
          {sorted.map((ws) => (
            <WorkspaceOption
              key={ws.id}
              workspace={ws}
              isActive={ws.id === currentWorkspace?.id}
              onSelect={() => {
                void setCurrentWorkspace(ws.id);
                setOpen(false);
              }}
            />
          ))}
          {sorted.length > 0 && <div className="mx-2 my-1 border-t border-border-soft" />}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddWorkspace();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FolderPlus size={13} aria-hidden />
            <span>Add workspace…</span>
          </button>
        </div>
      )}
    </div>
  );
}

function WorkspaceOption({
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
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
        isActive && 'bg-muted/60 text-foreground',
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
        {hasUnread && !isActive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
        )}
        <span
          className={cn(
            'relative inline-block h-1.5 w-1.5 rounded-full',
            hasUnread && !isActive
              ? 'bg-warning'
              : isActive
                ? 'bg-primary'
                : 'bg-muted-foreground/30',
          )}
        />
      </span>
      <FolderOpen
        size={13}
        aria-hidden
        className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
      />
      <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
      {isActive && <Check size={13} aria-hidden className="shrink-0 text-primary" />}
    </button>
  );
}
