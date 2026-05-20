import { useState } from 'react';
import { Button, Dialog } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';

// Tauri errors serialize as `{kind: string; message: string}` plain objects.
// `instanceof Error` is false for them, so `String(err)` → "[object Object]".
function unwrapError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const { message } = err as Record<string, unknown>;
    if (typeof message === 'string') return message;
  }
  return String(err);
}

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
      setError(unwrapError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="End session?"
      description="The worktree directory will be removed. The branch is preserved for manual merge."
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'Ending…' : 'End session'}
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-border-soft bg-subtle px-3 py-2 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{session.goal}</span>
      </div>
    </Dialog>
  );
}
