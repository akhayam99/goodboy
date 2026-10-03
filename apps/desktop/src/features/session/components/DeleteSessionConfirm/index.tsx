import { useState, type ComponentProps } from 'react';
import { formatError, InlineConfirm } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../sessionTitle';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const KEPT_IN_IMPACT =
  'Frees the transcript, file versions and images. Cost and shipped work stay in Impact.';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
  readonly className?: string;
  readonly surface?: ComponentProps<typeof InlineConfirm>['surface'];
};

export const DeleteSessionConfirm = ({ session, onClose, className, surface }: Props) => {
  const deleteTask = useAppStore((s) => s.deleteTask);
  const { archive } = useSessionArchive();
  const sessionBranch = useAppStore((s) => s.sessionBranches[session.id as SessionId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBranchless = isBranchlessSession({ branch: sessionBranch });
  const description = isBranchless
    ? KEPT_IN_IMPACT
    : `${KEPT_IN_IMPACT} The branch and its commits stay in the repository, and a worktree still holding uncommitted work is kept and listed under Settings, Storage.`;

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
      await archive({ sessions: [session] });
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
      icon={<CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />}
      title="Delete session?"
      description={description}
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onClose}
      isBusy={busy}
      surface={surface}
      className={className}
      {...(session.archivedAt == null && {
        altAction: {
          label: 'Archive instead',
          icon: <CONCEPT_ICONS.archive size={11} aria-hidden />,
          onClick: () => void onArchiveInstead(),
        },
      })}
    >
      <p className="truncate rounded-md border border-border-soft bg-subtle px-2 py-1 font-mono text-foreground">
        {sessionTitle({ session })}
      </p>
      <p className="font-medium text-danger">This cannot be undone.</p>
      {error != null && <p className="font-medium text-danger">{error}</p>}
    </InlineConfirm>
  );
};
