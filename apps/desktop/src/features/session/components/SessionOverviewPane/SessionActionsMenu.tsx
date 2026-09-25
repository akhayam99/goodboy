import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { AnchoredPopover, IconButton, MenuItems, cn, useDropdown } from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { DeleteSessionConfirm } from '../DeleteSessionConfirm';

type Props = {
  readonly session: Session;
};

const LABEL = 'Session actions';

export const SessionActionsMenu = ({ session }: Props) => {
  const { archive } = useSessionArchive();
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedWidth: 320 });
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (dropdown.open) {
      return;
    }
    setIsConfirmingDelete(false);
  }, [dropdown.open]);

  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'archive',
      label: 'Archive session',
      icon: CONCEPT_ICONS.archive,
      onClick: () => {
        dropdown.close();
        void archive({ sessions: [session] });
      },
    },
    {
      kind: 'item',
      key: 'delete',
      label: 'Delete session',
      icon: CONCEPT_ICONS.delete,
      destructive: true,
      onClick: () => setIsConfirmingDelete(true),
    },
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role={isConfirmingDelete ? 'dialog' : 'menu'}
      ariaLabel={isConfirmingDelete ? 'Delete session?' : LABEL}
      anchorClassName="flex shrink-0 items-center"
      className={cn('max-w-[calc(100vw-2rem)]', !isConfirmingDelete && 'py-1')}
      trigger={
        <IconButton
          variant="ghost"
          icon={CONCEPT_ICONS.more}
          iconSize={ICON_SIZE.row}
          label={LABEL}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn('size-6 shrink-0', dropdown.open && 'bg-muted')}
        />
      }
    >
      {isConfirmingDelete ? (
        <DeleteSessionConfirm session={session} onClose={dropdown.close} surface="plain" />
      ) : (
        <MenuItems items={items} onClose={() => undefined} />
      )}
    </AnchoredPopover>
  );
};
