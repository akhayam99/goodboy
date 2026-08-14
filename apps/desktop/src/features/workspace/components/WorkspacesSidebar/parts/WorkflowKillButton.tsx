import { useState } from 'react';
import { Ban } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowKillButton = ({ onConfirm }: Props) => {
  const [isArmed, setIsArmed] = useState(false);

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setIsArmed(true)}
        aria-label="Discard workflow"
        aria-expanded={isArmed}
        className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-muted-foreground motion-safe:transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <Ban size={14} aria-hidden />
        Discard
      </button>
      {isArmed ? (
        <InlineConfirm
          role="alert"
          icon={<Ban size={12} aria-hidden />}
          title="Discard workflow?"
          description="Moves the run to Discarded, where you can restore it. Agents already spawned stay in the session."
          confirmLabel="Discard"
          onConfirm={() => {
            setIsArmed(false);
            onConfirm();
          }}
          onCancel={() => setIsArmed(false)}
          className="absolute right-0 top-full z-popover mt-1 w-72 bg-background shadow-lg"
        />
      ) : null}
    </div>
  );
};
