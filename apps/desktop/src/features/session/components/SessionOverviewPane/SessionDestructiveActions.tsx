import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

const ARCHIVE_TITLE = `Archive session (${shortcutGlyphs('session.archive')})`;
const DELETE_TITLE = `Delete session (${shortcutGlyphs('session.delete')})`;

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

const DANGER_ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly session: Session;
};

export const SessionDestructiveActions = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const archived = session.archivedAt != null;

  const doUnarchive = () => {
    unarchiveTask(sessionId).catch((err: unknown) => {
      showToast('error', `couldn't unarchive: ${formatError(err)}`);
    });
  };

  const openArchiveConfirm = () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-archive-session'));
  };

  const openDeleteConfirm = () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-delete-session'));
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {archived ? (
        <button
          type="button"
          onClick={doUnarchive}
          title="Unarchive session"
          aria-label="Unarchive session"
          className={ICON_BUTTON}
        >
          <ArchiveRestore size={13} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={openArchiveConfirm}
          title={ARCHIVE_TITLE}
          aria-label="Archive session"
          className={ICON_BUTTON}
        >
          <Archive size={13} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={openDeleteConfirm}
        title={DELETE_TITLE}
        aria-label="Delete session"
        className={DANGER_ICON_BUTTON}
      >
        <Trash2 size={13} aria-hidden />
      </button>
    </div>
  );
};
