import { Bookmark, Clock, Code, Copy, FolderOpen, Trash2 } from 'lucide-react';
import type { OverflowMenuItem } from '@goodboy/ui';
import type {
  StorageBucket,
  StorageFolder,
  StorageFolderStatus,
} from '../../../../store/slices/storage/types';
import type { RemoveIntent } from './FolderRemoveConfirm';

export const KEEP_DAYS = 30;

export type RowMenuHandlers = {
  readonly onReveal: () => void;
  readonly onEditor: () => void;
  readonly onCopy: () => void;
  readonly onKeep: (days: number | null) => void;
  readonly onStopKeeping: () => void;
  readonly onRemove: (intent: RemoveIntent) => void;
};

type Params = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly bucket: StorageBucket;
  readonly handlers: RowMenuHandlers;
};

const SEPARATOR_KEEP: OverflowMenuItem = { kind: 'separator', key: 'keep-gap' };
const SEPARATOR_REMOVE: OverflowMenuItem = { kind: 'separator', key: 'remove-gap' };

const keepItems = ({ folder, bucket, handlers }: Params): ReadonlyArray<OverflowMenuItem> => {
  if (folder.origin === 'in-use') {
    return [];
  }
  if (bucket === 'kept') {
    return [
      SEPARATOR_KEEP,
      {
        kind: 'item',
        key: 'stop-keeping',
        label: 'Stop keeping',
        icon: Bookmark,
        onClick: handlers.onStopKeeping,
      },
    ];
  }
  return [
    SEPARATOR_KEEP,
    {
      kind: 'item',
      key: 'keep-30',
      label: `Keep for ${KEEP_DAYS} days`,
      icon: Clock,
      onClick: () => handlers.onKeep(KEEP_DAYS),
    },
    {
      kind: 'item',
      key: 'keep',
      label: 'Keep',
      icon: Bookmark,
      onClick: () => handlers.onKeep(null),
    },
  ];
};

const removeItems = ({ status, handlers }: Params): ReadonlyArray<OverflowMenuItem> => {
  if (status === 'dirty' || status === 'unavailable') {
    return [
      SEPARATOR_REMOVE,
      {
        kind: 'item',
        key: 'remove-anyway',
        label: 'Remove anyway…',
        icon: Trash2,
        destructive: true,
        onClick: () => handlers.onRemove('force'),
      },
    ];
  }
  if (status === 'not-tracked') {
    return [
      SEPARATOR_REMOVE,
      {
        kind: 'item',
        key: 'remove-untracked',
        label: 'Remove…',
        hint: "can't check changes",
        icon: Trash2,
        destructive: true,
        onClick: () => handlers.onRemove('untracked'),
      },
    ];
  }
  return [];
};

export const worktreeRowMenu = ({
  folder,
  status,
  bucket,
  handlers,
}: Params): ReadonlyArray<OverflowMenuItem> => [
  {
    kind: 'item',
    key: 'finder',
    label: 'Show in Finder',
    icon: FolderOpen,
    onClick: handlers.onReveal,
  },
  { kind: 'item', key: 'editor', label: 'Open in editor', icon: Code, onClick: handlers.onEditor },
  { kind: 'item', key: 'copy', label: 'Copy path', icon: Copy, onClick: handlers.onCopy },
  ...keepItems({ folder, status, bucket, handlers }),
  ...removeItems({ folder, status, bucket, handlers }),
];
