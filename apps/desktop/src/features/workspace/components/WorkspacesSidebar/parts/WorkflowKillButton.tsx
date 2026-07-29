import { useState } from 'react';
import { Ban } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowKillButton = ({ onConfirm }: Props) => {
  const [isArmed, setIsArmed] = useState(false);

  if (isArmed) {
    return (
      <InlineConfirm
        role="danger"
        icon={<Ban size={12} aria-hidden />}
        title="Discard workflow?"
        description="Drops the attached workflow run. Agents already spawned stay in the session."
        confirmLabel="Discard"
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
      title="discard workflow"
      aria-label="discard workflow"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-semibold text-danger motion-safe:transition-colors hover:bg-danger/10"
    >
      <Ban size={9} aria-hidden />
      Discard
    </button>
  );
};
