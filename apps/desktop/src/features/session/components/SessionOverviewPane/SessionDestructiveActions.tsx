import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import { cn, formatError, Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

type Props = {
  readonly session: Session;
};

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type HintParams = {
  readonly label: string;
  readonly hint: string;
};

const withHint = ({ label, hint }: HintParams): string =>
  hint === '' ? label : `${label} (${hint})`;

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
    window.dispatchEvent(
      new CustomEvent('goodboy:open-archive-session', { detail: { sessionId } }),
    );
  };

  const openDeleteConfirm = () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-delete-session', { detail: { sessionId } }));
  };

  const archiveLabel = archived ? 'Unarchive session' : 'Archive session';
  const archiveTooltip = archived
    ? archiveLabel
    : withHint({ label: archiveLabel, hint: shortcutGlyphs('session.archive') });
  const deleteTooltip = withHint({
    label: 'Delete session',
    hint: shortcutGlyphs('session.delete'),
  });

  return (
    <>
      <Tooltip content={archiveTooltip}>
        <button
          type="button"
          aria-label={archiveLabel}
          onClick={archived ? doUnarchive : openArchiveConfirm}
          className={ICON_BUTTON}
        >
          {archived ? <ArchiveRestore size={13} aria-hidden /> : <Archive size={13} aria-hidden />}
        </button>
      </Tooltip>
      <Tooltip content={deleteTooltip}>
        <button
          type="button"
          aria-label="Delete session"
          onClick={openDeleteConfirm}
          className={cn(ICON_BUTTON, 'text-danger/70 hover:bg-danger/10 hover:text-danger')}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </Tooltip>
    </>
  );
};
