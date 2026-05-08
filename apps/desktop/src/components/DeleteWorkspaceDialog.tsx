import { useState } from 'react';
import { Button, Dialog } from '@kay-am/ui';
import type { Workspace } from '@kay-am/types';
import { useAppStore } from '../store';

interface DeleteWorkspaceDialogProps {
  workspace: Workspace;
  open: boolean;
  onClose: () => void;
}

export function DeleteWorkspaceDialog({ workspace, open, onClose }: DeleteWorkspaceDialogProps) {
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteWorkspace(workspace.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="delete workspace?"
      description="all sessions in this workspace will also be removed. this cannot be undone."
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'deleting…' : 'delete workspace'}
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-border-soft bg-subtle px-3 py-2 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{workspace.name}</span>
        <span className="ml-2 text-muted-foreground/60">{workspace.rootPath}</span>
      </div>
    </Dialog>
  );
}
