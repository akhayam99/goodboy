import type { ReactNode } from 'react';
import { ConfirmPopover, type ConfirmPopoverTriggerParams } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly count: number;
  readonly onDelete: () => Promise<void>;
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
};

export const ChatPurgeConfirm = ({ count, onDelete, trigger }: Props) => (
  <ConfirmPopover
    role="danger"
    icon={<CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />}
    title={`Delete ${pluralize(count, 'archived chat')}?`}
    description="Their messages are removed from this device. Sessions started from them stay."
    confirmLabel={`Delete ${pluralize(count, 'chat')}`}
    onConfirm={onDelete}
    trigger={trigger}
    anchorClassName="flex w-full"
  />
);
