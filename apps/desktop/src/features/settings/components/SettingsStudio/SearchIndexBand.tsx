import { useEffect, useMemo } from 'react';
import type { ProjectId } from '@goodboy/types';
import { Band, Button, FieldRow, Listbox } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { searchProgressLabel } from '../../../search/components/SearchMode/searchProgressLabel';

type ExcludedParams = {
  readonly next: ReadonlyArray<ProjectId>;
};

export const SearchIndexBand = () => {
  const status = useAppStore((state) => state.searchIndexStatus ?? null);
  const isRebuilding = useAppStore((state) => state.isSearchIndexRebuilding === true);
  const loadStatus = useAppStore((state) => state.loadSearchIndexStatus);
  const rebuild = useAppStore((state) => state.rebuildSearchIndex);
  const setExcluded = useAppStore((state) => state.setProjectSearchExcluded);
  const reportError = useAppStore((state) => state.reportError);
  const projects = useAppStore((state) => state.projects ?? EMPTY_ARRAY);

  useEffect(() => {
    void loadStatus?.().catch(() => undefined);
  }, [loadStatus]);

  const options = useMemo(
    () =>
      projects
        .filter((project) => project.disconnectedAt == null)
        .map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const excluded = status?.excludedProjectIds ?? [];
  const progress = searchProgressLabel({ status });
  const size =
    status === null
      ? 'Reading the index'
      : `${formatBytes({ bytes: status.bytes })} for ${status.docs.toLocaleString()} items`;

  const changeExcluded = async ({ next }: ExcludedParams) => {
    const added = next.filter((id) => !excluded.includes(id));
    const removed = excluded.filter((id) => !next.includes(id));
    try {
      for (const projectId of added) {
        await setExcluded({ projectId, isExcluded: true });
      }
      for (const projectId of removed) {
        await setExcluded({ projectId, isExcluded: false });
      }
    } catch (error) {
      void reportError({ title: "Couldn't change what search leaves out", error });
    }
  };

  const startRebuild = async () => {
    try {
      await rebuild();
    } catch (error) {
      void reportError({ title: "Couldn't rebuild the search index", error });
    }
  };

  return (
    <Band
      inset="content"
      label="Search"
      hint="What ⌘F finds. The index lives in this app's database and never leaves this computer. Tool output and terminal output are never indexed."
      icon={<CONCEPT_ICONS.search size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col">
        <FieldRow label="Index" help={progress ?? 'Kept up to date as you work.'}>
          <span className="text-label text-muted-foreground">{size}</span>
        </FieldRow>
        <FieldRow
          label="Rebuild"
          help="Empties the index and fills it again from your sessions while the app is idle."
        >
          <Button
            size="sm"
            variant="secondary"
            isBusy={isRebuilding}
            busyLabel="Rebuilding"
            disabled={isRebuilding}
            onClick={() => void startRebuild()}
          >
            Rebuild
          </Button>
        </FieldRow>
        <FieldRow
          label="Leave out"
          help="Sessions, messages and branches of these projects stop showing in search."
        >
          <Listbox
            multiple
            size="sm"
            searchable
            noun="project"
            placeholder="No project"
            ariaLabel="Projects search leaves out"
            options={options}
            value={excluded}
            onChange={(values) => void changeExcluded({ next: values as ReadonlyArray<ProjectId> })}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
