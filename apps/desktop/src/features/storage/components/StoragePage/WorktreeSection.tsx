import { useEffect, useMemo, useState } from 'react';
import { Eyebrow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isStorageFolderSuggested } from '../../../../store/slices/storage/classifyStorageFolder';
import type { StorageFilter } from '../../../../store/slices/storage/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { groupStorageFolders } from '../../groupStorageFolders';
import { useStorageSummary } from '../../useStorageSummary';
import { BulkRemoveBar } from './BulkRemoveBar';
import { StorageOutcomeNotice } from './StorageOutcomeNotice';
import { WorkspaceFilterChip } from './WorkspaceFilterChip';
import { WorktreeColumns } from './WorktreeColumns';
import { WorktreeGroup } from './WorktreeGroup';
import type { ToggleFolderParams } from './types';

const EMPTY_COPY = {
  review: 'Nothing to review. Every folder Goodboy made is in use or kept.',
  'in-use': 'No worktree folder is in use right now.',
  kept: 'You are not keeping any folder.',
} as const satisfies Record<StorageFilter, string>;

const FolderIcon = CONCEPT_ICONS.worktree;

export const WorktreeSection = () => {
  const folders = useAppStore((state) => state.storageFolders);
  const roots = useAppStore((state) => state.storageRoots);
  const focus = useAppStore((state) => state.storageFocus);
  const focusStorage = useAppStore((state) => state.focusStorage);
  const { summary, suggestAfterDays, now } = useStorageSummary();
  const [filter, setFilter] = useState<StorageFilter>(focus?.filter ?? 'review');
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(focus?.workspaceId ?? null);
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (focus === null) {
      return;
    }
    setFilter(focus.filter);
    setWorkspaceId(focus.workspaceId);
    focusStorage(null);
  }, [focus, focusStorage]);

  const groups = useMemo(
    () => groupStorageFolders({ folders, roots, filter, workspaceId, now }),
    [folders, roots, filter, workspaceId, now],
  );
  const shownBytes = groups.reduce((sum, group) => sum + group.bytes, 0);
  const options: ReadonlyArray<SegmentedTabOption<StorageFilter>> = [
    { value: 'review', label: 'To review', badge: summary.review.count },
    { value: 'in-use', label: 'In use', badge: summary.inUse.count },
    { value: 'kept', label: 'Kept', badge: summary.kept.count },
  ];
  const suggested = groups
    .flatMap((group) => group.folders)
    .filter((folder) => isStorageFolderSuggested({ folder, now, suggestAfterDays }));
  const workspaceName =
    workspaceId === null
      ? null
      : (roots.find((root) => root.workspaceId === workspaceId)?.workspaceName ?? 'this workspace');

  const onFilter = (next: StorageFilter) => {
    setSelected(null);
    setFilter(next);
  };

  const onToggle = ({ path, isOn }: ToggleFolderParams) =>
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (isOn) {
        next.add(path);
        return next;
      }
      next.delete(path);
      return next;
    });

  return (
    <section id="storage-worktrees" aria-label="Worktrees" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow
          icon={<FolderIcon size={ICON_SIZE.row} aria-hidden />}
          label={`Worktrees · ${formatBytes({ bytes: shownBytes })}`}
        />
        <SegmentedTabs
          ariaLabel="Worktree folders"
          size="sm"
          options={options}
          value={filter}
          onChange={onFilter}
          className="ml-auto"
        />
      </div>
      <p className="text-2xs text-faint-foreground">
        Checkout folders of sessions that are archived, deleted or gone. Branches always stay in the
        repository.
      </p>
      {workspaceName === null ? null : (
        <WorkspaceFilterChip name={workspaceName} onClear={() => setWorkspaceId(null)} />
      )}
      <StorageOutcomeNotice />
      {groups.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">{EMPTY_COPY[filter]}</p>
      ) : (
        <div className="@container flex flex-col">
          <WorktreeColumns isSelecting={selected !== null} />
          {groups.map((group) => (
            <WorktreeGroup
              key={group.root.repoRoot}
              group={group}
              now={now}
              suggestAfterDays={suggestAfterDays}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
      {filter === 'review' ? (
        <BulkRemoveBar
          suggested={suggested}
          suggestAfterDays={suggestAfterDays}
          selected={selected}
          onStart={() => setSelected(new Set(suggested.map((folder) => folder.path)))}
          onCancel={() => setSelected(null)}
          onDone={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
};
