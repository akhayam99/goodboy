import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { cn, IconButton, tintClasses } from '@goodboy/ui';
import { withShortcutHint } from '../../../../shared/keyboard/registry';
import { useSessionArchive } from '../../../../shared/hooks/useSessionArchive';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { DeleteSessionConfirm } from '../DeleteSessionConfirm';

type Props = {
  readonly session: Session;
};

export const SessionDestructiveActions = ({ session }: Props) => {
  const { archive, restore } = useSessionArchive();
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const isArchived = session.archivedAt != null;

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

  const archiveLabel = isArchived ? 'Unarchive session' : 'Archive session';
  const archiveTooltip = withShortcutHint({
    label: archiveLabel,
    shortcut: 'session.archive',
  });
  const deleteTooltip = withShortcutHint({
    label: 'Delete session',
    shortcut: 'session.delete',
  });

  return (
    <>
      <IconButton
        variant="ghost"
        icon={isArchived ? CONCEPT_ICONS.restore : CONCEPT_ICONS.archive}
        iconSize={ICON_SIZE.row}
        label={archiveLabel}
        tooltip={archiveTooltip}
        onClick={() => void (isArchived ? restore : archive)({ sessions: [session] })}
        className="size-6 shrink-0"
      />
      <span className="relative flex shrink-0 items-center">
        <IconButton
          variant="ghost"
          tone={isDeleteArmed ? 'danger' : 'neutral'}
          icon={CONCEPT_ICONS.delete}
          iconSize={ICON_SIZE.row}
          label="Delete session"
          tooltip={deleteTooltip}
          aria-expanded={isDeleteArmed}
          onClick={() => setIsDeleteArmed((armed) => !armed)}
          className={cn(
            'size-6 shrink-0',
            tintClasses('danger').hoverText,
            tintClasses('danger').hoverBgSoft,
          )}
        />
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
