import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Band, SectionHeader, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore, useWorkspaces } from '../../../../store';
import {
  isStorageFolderSuggested,
  storageFolderStatus,
} from '../../../../store/slices/storage/classifyStorageFolder';
import type { StorageFilter, StorageScope } from '../../../../store/slices/storage/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { groupStorageFolders } from '../../groupStorageFolders';
import { useStorageSummary } from '../../useStorageSummary';
import { BulkRemoveBar } from './BulkRemoveBar';
import { ScanRepositoryRow } from './ScanRepositoryRow';
import { StorageOutcomeNotice } from './StorageOutcomeNotice';
import { WorktreeColumns } from './WorktreeColumns';
import { WorktreeGroup } from './WorktreeGroup';
import type { ToggleFolderParams } from './types';

const EMPTY_COPY = {
  review: 'Nothing to review. Every folder Goodboy made is in use or kept.',
  'in-use': 'No worktree folder is in use right now.',
  kept: 'You are not keeping any folder.',
} as const satisfies Record<StorageFilter, string>;

const FolderIcon = CONCEPT_ICONS.worktree;

type Props = {
  readonly scope: StorageScope;
};

export const WorktreeSection = ({ scope }: Props) => {
  const folders = useAppStore((state) => state.storageFolders);
  const roots = useAppStore((state) => state.storageRoots);
  const focus = useAppStore((state) => state.storageFocus);
  const focusStorage = useAppStore((state) => state.focusStorage);
  const workspaces = useWorkspaces();
  const workspaceName =
    scope.kind === 'workspace'
      ? (workspaces.find((workspace) => workspace.id === scope.id)?.name ?? null)
      : null;
  const { summary, suggestAfterDays, now } = useStorageSummary({ scope });
  const [filter, setFilter] = useState<StorageFilter>(focus?.filter ?? 'review');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focus === null) {
      return;
    }
    setFilter(focus.filter);
    sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    focusStorage(null);
  }, [focus, focusStorage]);

  const groups = useMemo(
    () => groupStorageFolders({ folders, roots, filter, scope, now }),
    [folders, roots, filter, scope, now],
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

  const selectable = useMemo(
    () =>
      groups
        .flatMap((group) => group.folders)
        .filter((folder) => storageFolderStatus({ folder }) === 'safe')
        .map((folder) => folder.path),
    [groups],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setIsConfirming(false);
  }, []);

  const onFilter = (next: StorageFilter) => {
    clearSelection();
    setFilter(next);
  };

  const onToggle = ({ path, isOn }: ToggleFolderParams) => {
    setIsConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (isOn) {
        next.add(path);
        return next;
      }
      next.delete(path);
      return next;
    });
  };

  const selectAll = useCallback(() => {
    setIsConfirming(false);
    setSelected(new Set(selectable));
  }, [selectable]);

  useSelectionKeys({
    containerRef: sectionRef,
    hasSelection: selected.size > 0 && filter === 'review',
    isEnabled: filter === 'review',
    onToggle: (path) => {
      if (selectable.includes(path)) {
        onToggle({ path, isOn: !selected.has(path) });
      }
    },
    onSelectAll: selectAll,
    onDelete: () => setIsConfirming(true),
  });

  return (
    <section
      ref={sectionRef}
      id="storage-worktrees"
      aria-label="Worktrees"
      data-selecting={selected.size > 0}
      className="group/select-list flex flex-col gap-2"
    >
      <SectionHeader
        label={`Worktrees · ${formatBytes({ bytes: shownBytes })}`}
        icon={<FolderIcon size={ICON_SIZE.row} aria-hidden />}
        hint="Checkout folders of sessions that are archived, deleted or gone. Branches always stay in the repository."
        action={
          <SegmentedTabs
            ariaLabel="Worktree folders"
            size="sm"
            options={options}
            value={filter}
            onChange={onFilter}
          />
        }
      />
      <StorageOutcomeNotice />
      <Band>
        {groups.length === 0 ? (
          <p className="px-2 py-2 text-label text-muted-foreground">{EMPTY_COPY[filter]}</p>
        ) : (
          <div className="@container flex flex-col">
            <WorktreeColumns />
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
        <ScanRepositoryRow />
      </Band>
      {filter === 'review' ? (
        <BulkRemoveBar
          suggested={suggested}
          suggestAfterDays={suggestAfterDays}
          workspaceName={workspaceName}
          selected={selected}
          total={selectable.length}
          isConfirming={isConfirming}
          onStart={() => {
            setSelected(new Set(suggested.map((folder) => folder.path)));
            setIsConfirming(true);
          }}
          onArm={() => setIsConfirming(true)}
          onCancel={() => setIsConfirming(false)}
          onClear={clearSelection}
          onSelectAll={selectAll}
          onDone={clearSelection}
        />
      ) : null}
    </section>
  );
};
