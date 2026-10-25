import type { ReactNode } from 'react';
import { ConfirmPopover, ICON_SIZE, type ConfirmPopoverTriggerParams } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly title: string;
  readonly canArchive: boolean;
  readonly onDelete: () => Promise<void>;
  readonly onArchive: () => void;
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
  readonly isOpen?: boolean;
  readonly onCancel?: () => void;
};

export const ChatDeleteConfirm = ({
  title,
  canArchive,
  onDelete,
  onArchive,
  trigger,
  isOpen,
  onCancel,
}: Props) => (
  <ConfirmPopover
    role="danger"
    icon={<CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />}
    title={`Delete "${title}"?`}
    description="Its messages are removed from this device. Sessions started from it stay."
    confirmLabel="Delete chat"
    onConfirm={onDelete}
    onCancel={onCancel}
    trigger={trigger}
    isOpen={isOpen}
    returnFocusTo={{ rowSelector: '[data-chat-row]' }}
    {...(canArchive && {
      altAction: {
        label: 'Archive instead',
        icon: <CONCEPT_ICONS.archive size={ICON_SIZE.row} aria-hidden />,
        onClick: onArchive,
      },
    })}
  />
);
