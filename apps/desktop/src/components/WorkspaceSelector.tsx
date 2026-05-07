import { useEffect, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input } from '@kay-am/ui';
import { useAppStore } from '../store';
import { useCurrentWorkspace, useWorkspaces } from '../store';

export function WorkspaceSelector() {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const addWorkspace = useAppStore((s) => s.addWorkspace);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

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
    <div className="relative" ref={menuRef}>
      <Button variant="secondary" size="sm" onClick={() => setMenuOpen((v) => !v)}>
        {current?.name ?? 'select workspace'}
        <span aria-hidden className="ml-1 text-muted-foreground">
          ▾
        </span>
      </Button>

      {menuOpen ? (
        <div className="absolute left-0 top-9 z-10 w-64 rounded-md border border-border bg-background py-1 shadow-lg">
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">no workspaces yet</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {workspaces.map((ws) => (
                <li key={ws.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-muted"
                    onClick={() => {
                      void setCurrentWorkspace(ws.id);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === current?.id ? (
                      <span aria-hidden className="text-muted-foreground">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border" />
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted"
            onClick={() => {
              setMenuOpen(false);
              setDialogOpen(true);
            }}
          >
            + add workspace
          </button>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="add workspace">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
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
