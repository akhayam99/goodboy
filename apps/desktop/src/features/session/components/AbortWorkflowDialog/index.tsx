import { useState } from 'react';
import { Button, Dialog } from '@kay-am/ui';
import type { Session } from '@kay-am/types';
import { useAppStore } from '../../../../store';

function unwrapError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const { message } = err as Record<string, unknown>;
    if (typeof message === 'string') return message;
  }
  return String(err);
}

interface AbortWorkflowDialogProps {
  readonly session: Session;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function AbortWorkflowDialog({ session, open, onClose }: AbortWorkflowDialogProps) {
  const abortWorkflow = useAppStore((s) => s.abortWorkflow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.workflowAborted) return null;

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await abortWorkflow(session.id);
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
      title="Abort workflow?"
      description="Completed steps are preserved. Pending steps will be skipped. You can continue with custom agents."
      size="sm"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'Aborting…' : 'Abort workflow'}
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
