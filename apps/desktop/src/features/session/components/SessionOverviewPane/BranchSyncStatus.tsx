import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { AnchoredPopover, Tooltip, useDropdown } from '@goodboy/ui';
import type { GitDistance, SessionId, WorktreeStatus } from '@goodboy/types';
import { unknownReasonLabel } from '../../../../shared/lib/gitStatus';
import { worktreeStatus } from '../../../worktree/worktree';
import { useActiveMount } from '../../hooks/useActiveMount';

type Props = {
  readonly sessionId: SessionId;
};

const TRIGGER_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type SyncLabelParams = {
  readonly distance: GitDistance;
};

const syncLabel = ({ distance }: SyncLabelParams): string => {
  if (distance.kind === 'unknown') {
    return `Position unknown: ${unknownReasonLabel({ reason: distance.reason })}`;
  }
  const { ahead, behind } = distance;
  if (ahead === 0 && behind === 0) {
    return 'In sync with main';
  }
  if (ahead === 0) {
    return `${behind} ${behind === 1 ? 'commit' : 'commits'} behind main`;
  }
  const aheadPart = `${ahead} ${ahead === 1 ? 'commit' : 'commits'} ahead of main`;
  if (behind === 0) {
    return aheadPart;
  }
  return `${aheadPart}, ${behind} behind`;
};

export const BranchSyncStatus = ({ sessionId }: Props) => {
  const activeMount = useActiveMount({ sessionId });
  const worktreePath = activeMount?.worktreePath ?? null;
  const [status, setStatus] = useState<WorktreeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 64,
    expectedWidth: 256,
    width: 'w-64',
  });

  if (worktreePath == null) {
    return null;
  }

  const onToggle = () => {
    if (!dropdown.open) {
      setIsLoading(true);
      setHasFailed(false);
      void worktreeStatus(worktreePath)
        .then((next) => setStatus(next))
        .catch(() => setHasFailed(true))
        .finally(() => setIsLoading(false));
    }
    dropdown.toggle();
  };

  const body = () => {
    if (isLoading && status == null) {
      return <p className="text-xs text-muted-foreground">Checking against main</p>;
    }
    if (status != null) {
      return (
        <p className="text-xs text-foreground">{syncLabel({ distance: status.mainDistance })}</p>
      );
    }
    if (hasFailed) {
      return <p className="text-xs text-muted-foreground">Could not read the branch position</p>;
    }
    return null;
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Sync with main"
      className="p-3"
      trigger={
        <Tooltip content="How far this branch is from main">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            aria-label="Sync with main"
            onClick={onToggle}
            className={TRIGGER_BUTTON}
          >
            <ArrowUpDown size={13} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      {body()}
    </AnchoredPopover>
  );
};
