import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowDeleteButton = ({ onConfirm }: Props) => {
  const [isArmed, setIsArmed] = useState(false);

  if (isArmed) {
    return (
      <InlineConfirm
        role="danger"
        icon={<Trash2 size={14} aria-hidden />}
        title="Delete workflow run?"
        description="Permanently removes this workflow run from the session."
        confirmLabel="Delete"
        onConfirm={() => {
          setIsArmed(false);
          onConfirm();
        }}
        onCancel={() => setIsArmed(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsArmed(true)}
      className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-danger/40 px-2 text-2xs font-semibold text-danger transition-colors hover:bg-danger/10"
    >
      <Trash2 size={14} aria-hidden />
      Delete
    </button>
  );
};
