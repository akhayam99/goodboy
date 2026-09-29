import { Mail, MailOpen, Pencil, Pin, PinOff } from 'lucide-react';
import type { MenuEntry } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Params = {
  readonly isPinned: boolean;
  readonly isUnread: boolean;
  readonly onRename: () => void;
  readonly onToggleUnread: () => void;
  readonly onTogglePin: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
};

export const chatRowMenuEntries = ({
  isPinned,
  isUnread,
  onRename,
  onToggleUnread,
  onTogglePin,
  onArchive,
  onDelete,
}: Params): ReadonlyArray<MenuEntry> => [
  { kind: 'item', key: 'rename', label: 'Rename', icon: Pencil, onSelect: onRename },
  {
    kind: 'item',
    key: 'unread',
    label: isUnread ? 'Mark as read' : 'Mark as unread',
    icon: isUnread ? MailOpen : Mail,
    onSelect: onToggleUnread,
  },
  {
    kind: 'item',
    key: 'pin',
    label: isPinned ? 'Unpin' : 'Pin',
    icon: isPinned ? PinOff : Pin,
    onSelect: onTogglePin,
  },
  {
    kind: 'item',
    key: 'archive',
    label: 'Archive',
    icon: CONCEPT_ICONS.archive,
    onSelect: onArchive,
  },
  { kind: 'separator', key: 'danger' },
  {
    kind: 'item',
    key: 'delete',
    label: 'Delete',
    icon: CONCEPT_ICONS.delete,
    isDestructive: true,
    onSelect: onDelete,
  },
];
