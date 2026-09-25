import type { Session } from '@goodboy/types';
import { AnchoredPopover, cn, IconButton, tintClasses, useDropdown } from '@goodboy/ui';
import { withShortcutHint } from '../../../../shared/keyboard/registry';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { DeleteSessionConfirm } from '../DeleteSessionConfirm';

type Props = {
  readonly session: Session;
};

const CONFIRM_WIDTH = 320;

export const SessionDestructiveActions = ({ session }: Props) => {
  const { archive, restore } = useSessionArchive();
  const deleteConfirm = useDropdown({ align: 'end', width: 'w-80', expectedWidth: CONFIRM_WIDTH });
  const isDeleteArmed = deleteConfirm.open;
  const isArchived = session.archivedAt != null;

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
      <AnchoredPopover
        dropdown={deleteConfirm}
        role="dialog"
        ariaLabel="Delete session?"
        anchorClassName="flex shrink-0 items-center"
        className="max-w-[calc(100vw-2rem)]"
        trigger={
          <IconButton
            variant="ghost"
            tone={isDeleteArmed ? 'danger' : 'neutral'}
            icon={CONCEPT_ICONS.delete}
            iconSize={ICON_SIZE.row}
            label="Delete session"
            tooltip={deleteTooltip}
            aria-expanded={isDeleteArmed}
            onClick={deleteConfirm.toggle}
            className={cn(
              'size-6 shrink-0',
              tintClasses('danger').hoverText,
              tintClasses('danger').hoverBgSoft,
            )}
          />
        }
      >
        <DeleteSessionConfirm session={session} onClose={deleteConfirm.close} surface="plain" />
      </AnchoredPopover>
    </>
  );
};
