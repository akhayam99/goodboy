import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import { InlineConfirm, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { useToast } from '../../../../../app/components/Toast';
import { EditorMenu } from '../../SessionOverviewPane/EditorMenu';
import { SessionGitActions } from '../../SessionWorkspace/parts/SessionGitActions';
import type { Density } from '../../../density';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';

const ARCHIVE_TITLE = `Archive session (${shortcutGlyphs('session.archive')})`;
const DELETE_TITLE = `Delete session (${shortcutGlyphs('session.delete')})`;

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly session: Session;
};

type Armed = 'archive' | 'delete' | null;

export const SessionNavFooter = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const archiveTask = useAppStore((s) => s.archiveTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const archived = Boolean(session.archivedAt);

  const [armed, setArmed] = useState<Armed>(null);
  const [busy, setBusy] = useState(false);
  const density: Density = armed === null ? 'full' : 'compact';

  useEffect(() => {
    if (armed == null) {
      return;
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      setArmed(null);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [armed]);

  const doUnarchive = () => {
    unarchiveTask(sessionId).catch((err: unknown) => {
      showToast('error', `couldn't unarchive: ${formatError(err)}`);
    });
  };

  const doArchive = () => {
    setBusy(true);
    archiveTask(sessionId)
      .catch((err: unknown) => showToast('error', `couldn't archive: ${formatError(err)}`))
      .finally(() => {
        setBusy(false);
        setArmed(null);
      });
  };

  const doDelete = () => {
    setBusy(true);
    deleteTask(sessionId)
      .catch((err: unknown) => showToast('error', `couldn't delete: ${formatError(err)}`))
      .finally(() => {
        setBusy(false);
        setArmed(null);
      });
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <EditorMenu sessionId={sessionId} density={density} />
        <SessionGitActions session={session} density={density} />
        <span className="flex-1" />
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
          ) : armed === 'archive' ? null : (
            <button
              type="button"
              onClick={() => setArmed('archive')}
              title={ARCHIVE_TITLE}
              aria-label="Archive session"
              className={ICON_BUTTON}
            >
              <Archive size={13} aria-hidden />
            </button>
          )}
          {armed === 'delete' ? null : (
            <button
              type="button"
              onClick={() => setArmed('delete')}
              title={DELETE_TITLE}
              aria-label="Delete session"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <Trash2 size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {armed === 'archive' && (
        <InlineConfirm
          role="alert"
          icon={<Archive size={12} aria-hidden />}
          title="Archive session?"
          description="Moves it to the Archived tab. Reversible anytime with Unarchive."
          confirmLabel="Archive session"
          onConfirm={doArchive}
          onCancel={() => setArmed(null)}
          isBusy={busy}
        />
      )}
      {armed === 'delete' && (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={12} aria-hidden />}
          title="Delete session?"
          description="Permanently removes this session from this device. This cannot be undone."
          confirmLabel="Delete session"
          onConfirm={doDelete}
          onCancel={() => setArmed(null)}
          isBusy={busy}
        />
      )}
    </div>
  );
};
