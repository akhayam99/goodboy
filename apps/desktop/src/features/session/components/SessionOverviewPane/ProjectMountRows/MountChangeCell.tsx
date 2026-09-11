import { Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../store';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { DiffStat } from '../../DiffStat';
import {
  hasDiffCounts,
  mountWorktreeStateLabel,
  mountWorktreeStateTitle,
  type MountWorktreeState,
} from './mountRowState';

type Props = {
  readonly sessionId: SessionId;
  readonly label: string;
  readonly worktreePath: string | null;
  readonly diffStat: MountDiffStat | null;
  readonly state: MountWorktreeState;
};

const TEXT_TONE: Record<MountWorktreeState['kind'], string> = {
  reading: 'text-muted-foreground/50',
  unknown: 'text-warning/80',
  clean: 'text-muted-foreground/50',
  modified: 'text-muted-foreground',
};

export const MountChangeCell = ({ sessionId, label, worktreePath, diffStat, state }: Props) => {
  const openMountDiff = useAppStore((store) => store.openMountDiff);
  const hasCounts = hasDiffCounts({ diffStat });

  if (hasCounts && diffStat !== null && worktreePath !== null) {
    return (
      <Tooltip content={`View changes in ${label}`}>
        <button
          type="button"
          aria-label={`View the changes of ${label}`}
          onClick={() => openMountDiff(sessionId, worktreePath)}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs tabular-nums hover:bg-muted/40"
        >
          <CONCEPT_ICONS.diff
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
          <DiffStat additions={diffStat.additions} deletions={diffStat.deletions} size="inherit" />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={mountWorktreeStateTitle({ state, label })}>
      <span
        data-testid="mount-change-state"
        data-state={state.kind}
        className={cn('truncate px-1.5 text-xs', TEXT_TONE[state.kind])}
      >
        {mountWorktreeStateLabel({ state })}
      </span>
    </Tooltip>
  );
};
