import { useMemo, useState } from 'react';
import { Button, Eyebrow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import {
  isStorageArtifactSuggested,
  storageArtifactFilter,
} from '../../../../store/slices/storage/classifyStorageArtifact';
import type { StorageArtifactFilter } from '../../../../store/slices/storage/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { useStorageSummary } from '../../useStorageSummary';
import { ArtifactBulkDeleteBar } from './ArtifactBulkDeleteBar';
import { ArtifactColumns } from './ArtifactColumns';
import { ArtifactRow } from './ArtifactRow';
import type { ToggleArtifactParams } from './types';

const VISIBLE_ROWS = 8;

const EMPTY_COPY = {
  review: 'Nothing to review. Every artifact of a deleted session is kept.',
  kept: 'You are not keeping any artifact.',
} as const satisfies Record<StorageArtifactFilter, string>;

const ReportIcon = CONCEPT_ICONS.report;

export const ArtifactSection = () => {
  const artifacts = useAppStore((state) => state.storageArtifacts);
  const { suggestAfterDays, now } = useStorageSummary();
  const [filter, setFilter] = useState<StorageArtifactFilter>('review');
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const byFilter = useMemo(
    () => ({
      review: artifacts.filter((artifact) => storageArtifactFilter({ artifact, now }) === 'review'),
      kept: artifacts.filter((artifact) => storageArtifactFilter({ artifact, now }) === 'kept'),
    }),
    [artifacts, now],
  );
  const suggestedIds = useMemo(
    () =>
      new Set(
        byFilter.review
          .filter((artifact) => isStorageArtifactSuggested({ artifact, now, suggestAfterDays }))
          .map((artifact) => artifact.id),
      ),
    [byFilter.review, now, suggestAfterDays],
  );

  if (artifacts.length === 0) {
    return null;
  }

  const totalBytes = artifacts.reduce((sum, artifact) => sum + (artifact.sizeBytes ?? 0), 0);
  const shown = byFilter[filter];
  const visible = isExpanded || selected !== null ? shown : shown.slice(0, VISIBLE_ROWS);
  const hidden = shown.length - visible.length;
  const suggested = byFilter.review.filter((artifact) => suggestedIds.has(artifact.id));
  const options: ReadonlyArray<SegmentedTabOption<StorageArtifactFilter>> = [
    { value: 'review', label: 'To review', badge: byFilter.review.length },
    { value: 'kept', label: 'Kept', badge: byFilter.kept.length },
  ];

  const onFilter = (next: StorageArtifactFilter) => {
    setSelected(null);
    setFilter(next);
  };

  const onToggle = ({ id, isOn }: ToggleArtifactParams) =>
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (isOn) {
        next.add(id);
        return next;
      }
      next.delete(id);
      return next;
    });

  return (
    <section
      id="storage-artifacts"
      aria-label="Artifacts from deleted sessions"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow
          icon={<ReportIcon size={ICON_SIZE.row} aria-hidden />}
          label={`Artifacts from deleted sessions · ${artifacts.length} · ${formatBytes({ bytes: totalBytes })}`}
        />
        <SegmentedTabs
          ariaLabel="Artifacts from deleted sessions"
          size="sm"
          options={options}
          value={filter}
          onChange={onFilter}
          className="ml-auto"
        />
      </div>
      <p className="text-secondary text-faint-foreground">
        Copies in ~/.goodboy/workspaces/&lt;workspace&gt;/artifacts. They are small: clean them to
        tidy up, not for space. Opening one in the reader counts as use.
      </p>
      {shown.length === 0 ? (
        <p className="py-3 text-label text-muted-foreground">{EMPTY_COPY[filter]}</p>
      ) : (
        <div className="@container flex flex-col">
          <ArtifactColumns isSelecting={selected !== null} />
          {visible.map((artifact) => (
            <ArtifactRow
              key={artifact.id}
              artifact={artifact}
              now={now}
              suggestAfterDays={suggestAfterDays}
              isSelecting={selected !== null}
              isSelected={selected?.has(artifact.id) ?? false}
              isSuggested={suggestedIds.has(artifact.id)}
              onToggle={onToggle}
            />
          ))}
          {hidden > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setIsExpanded(true)}
            >
              Show {hidden} more
            </Button>
          ) : null}
        </div>
      )}
      {filter === 'review' ? (
        <ArtifactBulkDeleteBar
          suggested={suggested}
          suggestAfterDays={suggestAfterDays}
          selected={selected}
          onStart={() => setSelected(new Set(suggested.map((artifact) => artifact.id)))}
          onDone={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
};
