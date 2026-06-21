import { useState } from 'react';
import { Button, Dialog } from '@goodboy/ui';
import { Archive } from 'lucide-react';
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

export const DeleteSessionDialog = ({ session, open, onClose }: Props) => {
  const deleteTask = useAppStore((s) => s.deleteTask);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTask(session.id as SessionId);
      onClose();
    } catch (err) {
      setError(unwrapError(err));
    } finally {
      setBusy(false);
    }
  };

  const onArchiveInstead = async () => {
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
      title="Delete session?"
      description="Permanently removes the worktree and transcripts for this session from this device. The branch is preserved for manual merge."
      size="md"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {!session.archivedAt && (
            <Button variant="secondary" onClick={() => void onArchiveInstead()} disabled={busy}>
              <Archive size={13} aria-hidden className="mr-1.5" />
              {busy ? 'Working…' : 'Archive'}
            </Button>
          )}
          <Button variant="danger" onClick={() => void onConfirmDelete()} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-border-soft bg-subtle px-3 py-2 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{session.goal}</span>
        </div>
        <p className="text-xs font-medium text-danger">
          This cannot be undone. To keep the history, archive instead.
        </p>
      </div>
    </Dialog>
  );
};
