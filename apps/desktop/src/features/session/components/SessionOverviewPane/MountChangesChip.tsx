import { cn, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useActiveMount } from '../../hooks/useActiveMount';
import { DiffStat } from '../DiffStat';
import { VITAL_CHIP_FOCUS, VITAL_CHIP_FRAME, VITAL_CHIP_HOVER } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
};

export const MountChangesChip = ({ sessionId }: Props) => {
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const activeMount = useActiveMount({ sessionId });
  const stats = useMountDiffStats(sessionId);

  if (activeMount == null) {
    return null;
  }
  const stat = stats.get(activeMount.worktreePath);
  if (stat == null || (stat.additions === 0 && stat.deletions === 0)) {
    return null;
  }

  return (
    <Tooltip
      content={`Uncommitted work in ${activeMount.mountName}, click to see the changes`}
      side="top"
    >
      <button
        type="button"
        aria-label={`View the changes of ${activeMount.mountName}`}
        onClick={() => openMountDiff(sessionId, activeMount.worktreePath)}
        className={cn(
          VITAL_CHIP_FRAME,
          VITAL_CHIP_HOVER,
          VITAL_CHIP_FOCUS,
          'gap-1 px-2 tabular-nums',
        )}
      >
        <CONCEPT_ICONS.diff size={11} aria-hidden className="shrink-0" />
        <DiffStat additions={stat.additions} deletions={stat.deletions} size="inherit" />
      </button>
    </Tooltip>
  );
};
