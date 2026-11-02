import { useState, type KeyboardEvent, type Ref } from 'react';
import { InlineConfirm } from '../InlineConfirm';
import type { MenuConfirm, MenuItemEntry } from './menuTypes';
import { ICON_SIZE } from '../../iconSize';

type Props = {
  readonly entry: MenuItemEntry;
  readonly confirm: MenuConfirm;
  readonly listRef: Ref<HTMLDivElement>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onCancel: () => void;
  readonly onClose: () => void;
};

export const MenuConfirmView = ({
  entry,
  confirm,
  listRef,
  onKeyDown,
  onCancel,
  onClose,
}: Props) => {
  const [isBusy, setIsBusy] = useState(false);
  const Icon = entry.icon;
  return (
    <div ref={listRef} data-menu-panel onKeyDown={onKeyDown} className="w-80 max-w-full">
      <InlineConfirm
        role={confirm.role}
        icon={Icon === undefined ? null : <Icon size={ICON_SIZE.control} aria-hidden />}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        isBusy={isBusy}
        note={
          confirm.notes === undefined || confirm.notes.length === 0 ? undefined : (
            <ul className="flex min-w-0 flex-col gap-0.5 text-muted-foreground">
              {confirm.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )
        }
        {...(confirm.alt !== undefined && {
          altAction: {
            label: confirm.alt.label,
            onClick: () => {
              onClose();
              void confirm.alt?.onSelect();
            },
          },
        })}
        onConfirm={async () => {
          setIsBusy(true);
          try {
            await entry.onSelect(null);
          } finally {
            setIsBusy(false);
            onClose();
          }
        }}
        onCancel={onCancel}
      />
    </div>
  );
};
