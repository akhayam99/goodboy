import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowDeleteButton = ({ onConfirm }: Props) => {
  const [isArmed, setIsArmed] = useState(false);

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setIsArmed(true)}
        aria-expanded={isArmed}
        className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-danger/70 transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={14} aria-hidden />
        Delete
      </button>
      {isArmed ? (
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
          className="absolute right-0 top-full z-40 mt-1 w-72 bg-background shadow-lg"
        />
      ) : null}
    </div>
  );
};
