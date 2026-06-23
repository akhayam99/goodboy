import { useState } from 'react';
import { Button, Dialog, ScrollFade } from '@goodboy/ui';
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
  sessions: ReadonlyArray<Session>;
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
};

export const BulkDeleteSessionsDialog = ({ sessions, open, onClose, onConfirmed }: Props) => {
  const bulkDeleteTask = useAppStore((s) => s.bulkDeleteTask);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = sessions.length;

  const onConfirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await bulkDeleteTask(sessions.map((s) => s.id as SessionId));
      onConfirmed?.();
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
      title={`Delete ${count} sessions?`}
      description="Permanently removes the worktrees and transcripts for these sessions from this device. Branches are preserved for manual merge."
      size="md"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirmDelete()} disabled={busy}>
            {busy ? 'Deleting…' : `Delete (${count})`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <ScrollFade
          fadeFrom="subtle"
          className="max-h-48 rounded-md border border-border-soft bg-subtle text-xs text-muted-foreground"
          viewportClassName="flex flex-col gap-1 px-3 py-2"
        >
          {sessions.map((session) => (
            <span key={session.id} className="font-mono text-foreground">
              {session.goal}
            </span>
          ))}
        </ScrollFade>
        <p className="text-xs font-medium text-danger">This cannot be undone.</p>
      </div>
    </Dialog>
  );
};
