import { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
  readonly className?: string;
};

export const DeleteSessionConfirm = ({ session, onClose, className }: Props) => {
  const deleteTask = useAppStore((s) => s.deleteTask);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const workspaceKind = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === session.workspaceId)?.kind,
  );
  const sessionBranch = useAppStore((s) => s.sessionBranches[session.id as SessionId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBranchless = isBranchlessSession({ workspaceKind, branch: sessionBranch });
  const description = isBranchless
    ? 'Permanently removes this session, its transcripts, and every saved file version from this device.'
    : 'Permanently removes the worktree and transcripts for this session from this device. The branch is preserved for manual merge.';
  const warning = isBranchless
    ? 'This cannot be undone. Saved file versions are deleted with this session.'
    : 'This cannot be undone. To keep the history, archive instead.';

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTask(session.id as SessionId);
      onClose();
    } catch (err) {
      setError(formatError(err));
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
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InlineConfirm
      role="danger"
      icon={<Trash2 size={12} aria-hidden />}
      title="Delete session?"
      description={description}
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onClose}
      isBusy={busy}
      className={className}
      note={
        session.archivedAt == null && (
          <button
            type="button"
            onClick={() => void onArchiveInstead()}
            disabled={busy}
            className="inline-flex w-fit items-center gap-1 rounded-md border border-border px-2 py-0.5 font-semibold text-foreground motion-safe:transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Archive size={11} aria-hidden />
            Archive instead
          </button>
        )
      }
    >
      <p className="truncate rounded-md border border-border-soft bg-subtle px-2 py-1 font-mono text-foreground">
        {session.goal}
      </p>
      <p className="font-medium text-danger">{warning}</p>
      {error != null && <p className="font-medium text-danger">{error}</p>}
    </InlineConfirm>
  );
};
