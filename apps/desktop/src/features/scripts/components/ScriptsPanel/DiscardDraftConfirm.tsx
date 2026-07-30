import { FileWarning } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';

type Props = {
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
};

export const DiscardDraftConfirm = ({ onSave, onDiscard, onCancel }: Props) => {
  return (
    <InlineConfirm
      role="alert"
      icon={<FileWarning size={12} aria-hidden />}
      title="Unsaved changes"
      description="This script has unsaved edits. Save them or discard to continue."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onConfirm={onDiscard}
      onCancel={onCancel}
      className="shrink-0"
      note={
        <button
          type="button"
          onClick={onSave}
          className="inline-flex w-fit items-center rounded-md border border-border px-2 py-0.5 font-semibold text-foreground motion-safe:transition-colors hover:bg-muted"
        >
          Save
        </button>
      }
    />
  );
};
