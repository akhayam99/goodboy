import type { ReactNode } from 'react';
import { FileWarning } from 'lucide-react';
import { ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isOpen: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
  readonly trigger: () => ReactNode;
};

export const DiscardDraftConfirm = ({ isOpen, onSave, onDiscard, onCancel, trigger }: Props) => (
  <ConfirmPopover
    role="alert"
    icon={<FileWarning size={ICON_SIZE.row} aria-hidden />}
    title="Unsaved changes"
    description="This script has unsaved edits. Save them or discard to continue."
    confirmLabel="Discard"
    cancelLabel="Keep editing"
    isOpen={isOpen}
    onConfirm={onDiscard}
    onCancel={onCancel}
    altAction={{ label: 'Save', onClick: onSave }}
    trigger={trigger}
  />
);
