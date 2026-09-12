import { useState } from 'react';
import { cn, formatError } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useToast } from '../../../../../app/components/Toast';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly label: string;
  readonly className?: string;
};

export const WriteDestinationAction = ({ sessionId, mountId, label, className }: Props) => {
  const setSessionActiveMount = useAppStore((state) => state.setSessionActiveMount);
  const { showToast } = useToast();
  const [isApplying, setIsApplying] = useState(false);

  const apply = async () => {
    setIsApplying(true);
    try {
      await setSessionActiveMount({ sessionId, mountId });
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isApplying}
      aria-label={`Use ${label} for the next turns`}
      title={`The next turns of this session write to ${label}.`}
      onClick={() => void apply()}
      className={cn(
        'shrink-0 rounded-md px-1.5 py-0.5 text-3xs text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {isApplying ? 'Applying…' : 'Use for next turns'}
    </button>
  );
};
