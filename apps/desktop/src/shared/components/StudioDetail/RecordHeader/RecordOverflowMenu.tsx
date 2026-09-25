import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  AnchoredPopover,
  IconButton,
  InlineConfirm,
  MenuItems,
  cn,
  useDropdown,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../conceptIcons';
import type { RecordVerb } from '../RecordActions/types';
import { recordMenuItems } from './recordMenuItems';

type Props = {
  readonly label: string;
  readonly overflow: ReadonlyArray<RecordVerb>;
  readonly sessionVerbs: ReadonlyArray<RecordVerb>;
  readonly destructive: ReadonlyArray<RecordVerb>;
  readonly onRefresh: (() => void) | null;
  readonly onCopyLink: (() => void) | null;
};

export const RecordOverflowMenu = ({
  label,
  overflow,
  sessionVerbs,
  destructive,
  onRefresh,
  onCopyLink,
}: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-72', expectedHeight: 240 });
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const { open: isOpen, close, toggle } = dropdown;

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setConfirmingKey(null);
  }, [isOpen]);

  const items = recordMenuItems({
    overflow,
    sessionVerbs,
    destructive,
    onRefresh,
    onCopyLink,
    onConfirm: setConfirmingKey,
    onDone: close,
  });
  if (items.length === 0) {
    return null;
  }
  const confirming =
    [...overflow, ...sessionVerbs, ...destructive].find((verb) => verb.key === confirmingKey) ??
    null;
  const confirm = confirming?.confirm ?? null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={label}
      anchorClassName="shrink-0"
      className="py-1"
      trigger={
        <IconButton
          variant="ghost"
          icon={MoreHorizontal}
          iconSize={ICON_SIZE.control}
          label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={toggle}
          className={cn(isOpen && 'bg-selected text-foreground')}
        />
      }
    >
      {confirming != null && confirm != null ? (
        <InlineConfirm
          role="danger"
          icon={<confirming.icon size={ICON_SIZE.control} aria-hidden />}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          surface="plain"
          isBusy={confirming.isBusy}
          isConfirmDisabled={confirming.blockedReason != null}
          onConfirm={async () => {
            await confirming.onRun();
            close();
          }}
          onCancel={() => setConfirmingKey(null)}
        />
      ) : (
        <MenuItems items={items} onClose={() => undefined} />
      )}
    </AnchoredPopover>
  );
};
