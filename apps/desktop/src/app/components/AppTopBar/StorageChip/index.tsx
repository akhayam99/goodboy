import { Tooltip } from '@goodboy/ui';
import { openStorage } from '../../../../features/storage/openStorage';
import { useStorageSummary } from '../../../../features/storage/useStorageSummary';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';

const GB = 1024 ** 3;

const StorageIcon = CONCEPT_ICONS.storage;

export const StorageChip = () => {
  const { summary } = useStorageSummary();
  const bytes = summary.canGo.bytes;
  if (bytes < GB) {
    return null;
  }
  const label = `Goodboy can free ${formatBytes({ bytes })} of worktree folders nobody uses. Open storage`;

  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        onClick={() => openStorage({ scope: { kind: 'all' } })}
        aria-label={label}
        className="flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-secondary text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground"
      >
        <StorageIcon size={ICON_SIZE.row} aria-hidden />
        <span className="tabular-nums">Free {Math.round(bytes / GB)} GB</span>
      </button>
    </Tooltip>
  );
};
