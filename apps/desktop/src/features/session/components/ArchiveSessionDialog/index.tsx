import { useState } from 'react';
import { Button, Dialog } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

function unwrapError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const { message } = err as Record<string, unknown>;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(err);
}

type Props = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

export const ArchiveSessionDialog = ({ session, open, onClose }: Props) => {
  const archiveTask = useAppStore((s) => s.archiveTask);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await archiveTask(session.id as SessionId);
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
      title="Archive session?"
      description="Moves it to the Archived tab and frees memory. The worktree, branch, and history stay on disk. Reversible anytime with Unarchive."
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'Archiving…' : 'Archive'}
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-border-soft bg-subtle px-3 py-2 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{session.goal}</span>
      </div>
    </Dialog>
  );
};
