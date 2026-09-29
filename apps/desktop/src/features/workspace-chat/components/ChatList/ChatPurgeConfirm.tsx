import { useState } from 'react';
import { InlineConfirm, formatError } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly count: number;
  readonly onDelete: () => Promise<void>;
  readonly onCancel: () => void;
};

export const ChatPurgeConfirm = ({ count, onDelete, onCancel }: Props) => {
  const [error, setError] = useState<string | null>(null);

  const confirm = async (): Promise<void> => {
    setError(null);
    try {
      await onDelete();
    } catch (failure) {
      setError(formatError(failure));
    }
  };

  return (
    <InlineConfirm
      role="danger"
      icon={<CONCEPT_ICONS.delete size={ICON_SIZE.row} aria-hidden />}
      title={`Delete ${pluralize(count, 'chat')} for good?`}
      description="Their messages are removed from this device. Sessions started from them stay."
      confirmLabel={`Delete ${count}`}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      {error === null ? null : <p className="font-medium text-danger">{error}</p>}
    </InlineConfirm>
  );
};
