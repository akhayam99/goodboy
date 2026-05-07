import { useState } from 'react';
import { Button, Dialog } from '@kay-am/ui';
import type { Session } from '@kay-am/types';
import { useAppStore } from '../store';

export function EndSessionButton({ session }: { session: Session }) {
  const endSession = useAppStore((s) => s.endSession);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.state.kind === 'ended') return null;

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await endSession(session.id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        end session
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="end session?">
        <p className="text-sm text-muted-foreground">
          this removes the worktree directory at the session path. the branch is preserved for
          manual merge.
        </p>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'ending…' : 'end'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
