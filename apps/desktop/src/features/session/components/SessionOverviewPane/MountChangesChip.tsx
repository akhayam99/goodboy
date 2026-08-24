import { cn, Tooltip } from '@goodboy/ui';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useMountDiffStats, type MountDiffStat } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { DiffStat } from '../DiffStat';
import { VITAL_CHIP_FOCUS, VITAL_CHIP_FRAME, VITAL_CHIP_HOVER } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
};

type ChangedMount = {
  readonly mount: SessionProjectMount;
  readonly stat: MountDiffStat;
};

type ChangedParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly stats: ReadonlyMap<string, MountDiffStat>;
};

const changedMounts = ({ mounts, stats }: ChangedParams): ReadonlyArray<ChangedMount> =>
  mounts.flatMap((mount) => {
    const stat = stats.get(mount.worktreePath);
    if (stat == null || (stat.additions === 0 && stat.deletions === 0)) {
      return [];
    }
    return [{ mount, stat }];
  });

const sizeOf = ({ stat }: { readonly stat: MountDiffStat }): number =>
  stat.additions + stat.deletions;

export const MountChangesChip = ({ sessionId }: Props) => {
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const stats = useMountDiffStats(sessionId);

  const changed = changedMounts({ mounts, stats });
  if (changed.length === 0) {
    return null;
  }

  const additions = changed.reduce((total, entry) => total + entry.stat.additions, 0);
  const deletions = changed.reduce((total, entry) => total + entry.stat.deletions, 0);
  const largest = changed.reduce((widest, entry) =>
    sizeOf({ stat: entry.stat }) > sizeOf({ stat: widest.stat }) ? entry : widest,
  );
  const isSingle = changed.length === 1;
  const projectWord = isSingle ? 'project' : 'projects';
  const label = isSingle ? null : `${changed.length} ${projectWord}`;
  const tooltip = isSingle
    ? `Uncommitted work in ${largest.mount.mountName}, click to see the changes`
    : `${changed.length} ${projectWord} have uncommitted work, click to see the changes`;
  const ariaLabel = isSingle
    ? `View the changes of ${largest.mount.mountName}`
    : `View the changes of ${changed.length} ${projectWord}`;

  return (
    <Tooltip content={tooltip} side="top">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => openMountDiff(sessionId, largest.mount.worktreePath)}
        className={cn(
          VITAL_CHIP_FRAME,
          VITAL_CHIP_HOVER,
          VITAL_CHIP_FOCUS,
          'gap-1 px-2 tabular-nums',
        )}
      >
        <CONCEPT_ICONS.diff size={11} aria-hidden className="shrink-0" />
        {label == null ? null : <span className="shrink-0">{label}</span>}
        <DiffStat additions={additions} deletions={deletions} size="inherit" />
      </button>
    </Tooltip>
  );
};
