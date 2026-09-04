import { useEffect, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { cn, formatError, Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { DeleteSessionConfirm } from '../DeleteSessionConfirm';

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
  const archiveTask = useAppStore((s) => s.archiveTask);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const archived = session.archivedAt != null;

  useEffect(() => {
    if (!isDeleteArmed) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setIsDeleteArmed(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isDeleteArmed]);

  const doArchive = () => {
    archiveTask(sessionId).catch((err: unknown) => {
      showToast('error', `couldn't archive: ${formatError(err)}`);
    });
  };

  const doUnarchive = () => {
    unarchiveTask(sessionId).catch((err: unknown) => {
      showToast('error', `couldn't unarchive: ${formatError(err)}`);
    });
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
          onClick={archived ? doUnarchive : doArchive}
          className={ICON_BUTTON}
        >
          {archived ? (
            <CONCEPT_ICONS.restore size={ICON_SIZE.row} aria-hidden />
          ) : (
            <CONCEPT_ICONS.archive size={ICON_SIZE.row} aria-hidden />
          )}
        </button>
      </Tooltip>
      <span className="relative flex shrink-0 items-center">
        <Tooltip content={deleteTooltip}>
          <button
            type="button"
            aria-label="Delete session"
            aria-expanded={isDeleteArmed}
            onClick={() => setIsDeleteArmed((armed) => !armed)}
            className={cn(ICON_BUTTON, 'text-danger/70 hover:bg-danger/10 hover:text-danger')}
          >
            <CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
        {isDeleteArmed ? (
          <DeleteSessionConfirm
            session={session}
            onClose={() => setIsDeleteArmed(false)}
            className="absolute right-0 top-full z-popover w-80 max-w-[calc(100vw-2rem)] bg-background shadow-lg"
          />
        ) : null}
      </span>
    </>
  );
};
