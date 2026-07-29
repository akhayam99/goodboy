import { useState } from 'react';
import { Archive } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
  readonly className?: string;
};

export const ArchiveSessionConfirm = ({ session, onClose, className }: Props) => {
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
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InlineConfirm
      role="primary"
      icon={<Archive size={12} aria-hidden />}
      title="Archive session?"
      description="Moves it to the Archived tab and frees memory. The worktree, branch, and history stay on disk. Reversible anytime with Unarchive."
      confirmLabel="Archive"
      onConfirm={onConfirm}
      onCancel={onClose}
      isBusy={busy}
      className={className}
    >
      <p className="truncate rounded-md border border-border-soft bg-subtle px-2 py-1 font-mono text-foreground">
        {session.goal}
      </p>
      {error != null && <p className="font-medium text-danger">{error}</p>}
    </InlineConfirm>
  );
};
