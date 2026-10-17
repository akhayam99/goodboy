import type { ReactNode } from 'react';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { ConfirmPopover, type ConfirmPopoverTriggerParams } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../sessionTitle';
import { DELETE_CANNOT_UNDO, DELETE_REMOVED_LINE, deleteKeptLine } from '../../deleteSessionCopy';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
  readonly isOpen?: boolean;
  readonly align?: 'start' | 'end';
  readonly anchorClassName?: string;
};

export const DeleteSessionConfirm = ({
  session,
  onClose,
  trigger,
  isOpen,
  align,
  anchorClassName,
}: Props) => {
  const { archive } = useSessionArchive();
  const deleteTask = useAppStore((s) => s.deleteTask);
  const sessionBranch = useAppStore((s) => s.sessionBranches[session.id]);
  const isBranchless = isBranchlessSession({ branch: sessionBranch });
  const onConfirm = async () => {
    await deleteTask(session.id);
    onClose();
  };

  return (
    <ConfirmPopover
      role="danger"
      icon={<CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />}
      title={`Delete ${sessionTitle({ session })}?`}
      confirmLabel="Delete session"
      onConfirm={onConfirm}
      onCancel={onClose}
      trigger={trigger}
      isOpen={isOpen}
      {...(align !== undefined && { align })}
      {...(anchorClassName !== undefined && { anchorClassName })}
      {...(session.archivedAt === null || session.archivedAt === undefined
        ? {
            altAction: {
              label: 'Archive instead',
              onClick: () => void archive({ sessions: [session] }).then(onClose),
            },
          }
        : {})}
      returnFocusTo={{ rowSelector: '[data-select-id]' }}
    >
      <p className="truncate rounded-md border border-border-soft bg-subtle px-2 py-1 font-mono text-foreground">
        {sessionTitle({ session })}
      </p>
      <p className="text-muted-foreground">{DELETE_REMOVED_LINE}</p>
      <p className="text-muted-foreground">{deleteKeptLine({ isBranchless })}</p>
      <p className="font-medium text-danger">{DELETE_CANNOT_UNDO}</p>
    </ConfirmPopover>
  );
};
