import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollArea } from '@kay-am/ui';
import { FolderPlus } from 'lucide-react';
import { useAppStore, useCurrentWorkspace, useWorkspaces } from '../store';
import { WorkspaceTree } from './WorkspaceTree';

interface WorkspacesSidebarProps {
  onOpenSettings: () => void;
}

export function WorkspacesSidebar({ onOpenSettings }: WorkspacesSidebarProps) {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const addWorkspace = useAppStore((s) => s.addWorkspace);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setDialogOpen(false);
      setPath('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          workspaces
        </span>
      </div>

      <ScrollArea className="flex-1">
        {workspaces.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            no workspaces yet — add one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5 px-2">
            {workspaces.map((ws) => (
              <WorkspaceTree
                key={ws.id}
                workspace={ws}
                isActive={ws.id === current?.id}
                onSelectWorkspace={(id) => void setCurrentWorkspace(id)}
                onOpenSettings={onOpenSettings}
              />
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="sticky bottom-0 border-t border-border-soft bg-subtle px-2 py-2">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <FolderPlus size={14} aria-hidden />
          add workspace
        </button>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="add workspace">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={path}
              placeholder="/path/to/repo"
              onChange={(e) => setPath(e.target.value)}
            />
            <Button variant="secondary" onClick={onPick}>
              browse
            </Button>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>
            cancel
          </Button>
          <Button onClick={onAdd} disabled={path.length === 0 || busy}>
            {busy ? 'adding…' : 'add'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
