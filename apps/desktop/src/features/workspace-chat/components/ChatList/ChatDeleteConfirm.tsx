import { useState } from 'react';
import { InlineConfirm, formatError } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly title: string;
  readonly canArchive: boolean;
  readonly onDelete: () => Promise<void>;
  readonly onArchive: () => void;
  readonly onCancel: () => void;
};

export const ChatDeleteConfirm = ({ title, canArchive, onDelete, onArchive, onCancel }: Props) => {
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
      title="Delete chat?"
      description="Its messages are removed from this device. Sessions started from it stay."
      confirmLabel="Delete"
      onConfirm={confirm}
      onCancel={onCancel}
      {...(canArchive && {
        altAction: {
          label: 'Archive instead',
          icon: <CONCEPT_ICONS.archive size={ICON_SIZE.row} aria-hidden />,
          onClick: onArchive,
        },
      })}
    >
      <p className="truncate rounded-md border border-border-soft bg-subtle px-2 py-1 text-foreground">
        {title}
      </p>
      {error === null ? null : <p className="text-danger">{error}</p>}
    </InlineConfirm>
  );
};
