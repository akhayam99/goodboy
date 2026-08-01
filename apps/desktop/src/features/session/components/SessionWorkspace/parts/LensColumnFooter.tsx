import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import { ConfirmPill } from '../../../../../shared/components/ConfirmPill';
import { useAppStore } from '../../../../../store';
import { formatError } from '../../../../../shared/lib/errors';
import { useToast } from '../../../../../app/components/Toast';
import { EditorMenu } from '../../SessionOverviewPane/EditorMenu';
import { SessionGitActions } from './SessionGitActions';

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly session: Session;
};

type Armed = 'archive' | 'delete' | null;

export const LensColumnFooter = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const archiveTask = useAppStore((s) => s.archiveTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const archived = Boolean(session.archivedAt);

  const [armed, setArmed] = useState<Armed>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="flex shrink-0 items-center gap-2 px-2 py-2">
      <EditorMenu sessionId={sessionId} />
      <SessionGitActions session={session} />
      <span className="flex-1" />
      <div className="flex items-center gap-1">
        {archived ? (
          <button
            type="button"
            onClick={doUnarchive}
            title="Unarchive session"
            aria-label="unarchive session"
            className={ICON_BUTTON}
          >
            <ArchiveRestore size={13} aria-hidden />
          </button>
        ) : armed === 'archive' ? (
          <ConfirmPill
            label="Archive?"
            confirmAria="archive session"
            busy={busy}
            onConfirm={doArchive}
            onCancel={() => setArmed(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setArmed('archive')}
            title="Archive session"
            aria-label="archive session"
            className={ICON_BUTTON}
          >
            <Archive size={13} aria-hidden />
          </button>
        )}
        {armed === 'delete' ? (
          <ConfirmPill
            label="Delete?"
            confirmAria="delete session"
            danger
            busy={busy}
            onConfirm={doDelete}
            onCancel={() => setArmed(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setArmed('delete')}
            title="Delete session"
            aria-label="delete session"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Trash2 size={13} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};
