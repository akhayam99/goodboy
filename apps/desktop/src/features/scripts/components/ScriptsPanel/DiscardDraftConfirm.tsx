import { FileWarning } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
};

export const DiscardDraftConfirm = ({ onSave, onDiscard, onCancel }: Props) => {
  return (
    <InlineConfirm
      role="alert"
      icon={<FileWarning size={ICON_SIZE.row} aria-hidden />}
      title="Unsaved changes"
      description="This script has unsaved edits. Save them or discard to continue."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onConfirm={onDiscard}
      onCancel={onCancel}
      className="shrink-0"
      altAction={{ label: 'Save', onClick: onSave }}
    />
  );
};
