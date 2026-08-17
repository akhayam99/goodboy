import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import { formatError, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

type Props = {
  readonly session: Session;
};

export const SessionDestructiveActions = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const archived = session.archivedAt != null;

  const doUnarchive = () => {
    unarchiveTask(sessionId).catch((err: unknown) => {
      showToast('error', `couldn't unarchive: ${formatError(err)}`);
    });
  };

  const openArchiveConfirm = () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-archive-session'));
  };

  const openDeleteConfirm = () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-delete-session'));
  };

  const archiveItem: OverflowMenuItem = archived
    ? {
        kind: 'item',
        key: 'unarchive',
        label: 'Unarchive session',
        icon: ArchiveRestore,
        onClick: doUnarchive,
      }
    : {
        kind: 'item',
        key: 'archive',
        label: 'Archive session',
        icon: Archive,
        onClick: openArchiveConfirm,
        hint: shortcutGlyphs('session.archive'),
      };
  const items: ReadonlyArray<OverflowMenuItem> = [
    archiveItem,
    {
      kind: 'item',
      key: 'delete',
      label: 'Delete session',
      icon: Trash2,
      onClick: openDeleteConfirm,
      destructive: true,
      hint: shortcutGlyphs('session.delete'),
    },
  ];

  return <OverflowMenu items={items} label="Session actions" align="right" />;
};
