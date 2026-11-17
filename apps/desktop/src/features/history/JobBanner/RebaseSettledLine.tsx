import type { MountId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { useNow } from '../../../shared/hooks/useNow';

type Props = {
  readonly mountId: MountId;
};

const SHOWN_MS = 6_000;

const LEAVING_MS = 1_000;

export const RebaseSettledLine = ({ mountId }: Props) => {
  const at = useAppStore((s) => s.rebaseSettleLines[mountId] ?? null);
  const now = useNow(1_000, at !== null);
  if (at === null) {
    return null;
  }
  const age = Math.max(0, now - at);
  if (age >= SHOWN_MS) {
    return null;
  }
  return (
    <p
      role="status"
      data-rebase-settled
      className={cn(
        'min-w-0 text-meta text-muted-foreground',
        age >= SHOWN_MS - LEAVING_MS
          ? 'motion-safe:animate-item-out'
          : 'motion-safe:animate-fade-in',
      )}
    >
      Origin now has your rebased commits
    </p>
  );
};
