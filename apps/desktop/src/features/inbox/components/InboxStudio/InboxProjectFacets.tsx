import { FacetRow, FacetSection } from '@goodboy/ui';
import { useState } from 'react';
import type { Project } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { InboxFacetCounts, InboxFilters } from '../../kindFilter';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly filters: InboxFilters;
  readonly counts: InboxFacetCounts;
  readonly note: string | null;
  readonly onFiltersChange: (filters: InboxFilters) => void;
};

export const InboxProjectFacets = ({ projects, filters, counts, note, onFiltersChange }: Props) => {
  const [isShowingEmpty, setIsShowingEmpty] = useState(false);
  const isVisible = (project: Project) =>
    counts.project(project.id) > 0 || filters.project === project.id;
  const hiddenCount = projects.filter((project) => !isVisible(project)).length;
  const shown = isShowingEmpty ? projects : projects.filter(isVisible);

  return (
    <FacetSection label="Project">
      {shown.map((project) => (
        <FacetRow
          key={project.id}
          icon={project.kind === 'repo' ? CONCEPT_ICONS.projectRepo : CONCEPT_ICONS.projectFolder}
          label={project.name}
          count={counts.project(project.id)}
          isSelected={filters.project === project.id}
          onClick={() =>
            onFiltersChange({
              ...filters,
              project: filters.project === project.id ? null : project.id,
            })
          }
        />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          aria-expanded={isShowingEmpty}
          onClick={() => setIsShowingEmpty((current) => !current)}
          className="self-start rounded-md px-2 py-1 text-meta text-faint-foreground hover:bg-hover hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {isShowingEmpty ? 'Hide empty' : `Show ${hiddenCount} empty`}
        </button>
      ) : null}
      {note === null ? null : (
        <p className="px-2 py-1 text-secondary text-faint-foreground">{note}</p>
      )}
    </FacetSection>
  );
};
