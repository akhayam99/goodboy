import { useState } from 'react';
import { Button, Dialog } from '@kay-am/ui';
import type { Session } from '@kay-am/types';
import { useAppStore } from '../store';

interface EndSessionDialogProps {
  session: Session;
  open: boolean;
  onClose: () => void;
}

export function EndSessionDialog({ session, open, onClose }: EndSessionDialogProps) {
  const endSession = useAppStore((s) => s.endSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.state.kind === 'ended') return null;

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await endSession(session.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="end session?">
      <p className="text-sm text-muted-foreground">
        this removes the worktree directory at the session path. the branch is preserved for manual
        merge.
      </p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          cancel
        </Button>
        <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
          {busy ? 'ending…' : 'end'}
        </Button>
      </div>
    </Dialog>
  );
}
