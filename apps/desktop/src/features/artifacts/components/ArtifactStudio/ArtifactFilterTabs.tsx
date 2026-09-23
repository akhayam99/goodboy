import { SegmentedTabs } from '@goodboy/ui';
import {
  ARTIFACT_FILTERS,
  ARTIFACT_FILTER_LABEL,
  type ArtifactFilter,
} from '../../artifactCollection';

type Props = {
  readonly value: ArtifactFilter;
  readonly counts: Readonly<Record<ArtifactFilter, number>>;
  readonly isCompact: boolean;
  readonly onChange: (filter: ArtifactFilter) => void;
};

export const ArtifactFilterTabs = ({ value, counts, isCompact, onChange }: Props) => (
  <SegmentedTabs
    ariaLabel="Artifact kind"
    size="sm"
    className="w-max shrink-0"
    value={value}
    onChange={onChange}
    options={ARTIFACT_FILTERS.map((filter) => ({
      value: filter,
      label: ARTIFACT_FILTER_LABEL[filter],
      ...(!isCompact && counts[filter] > 0 && { badge: counts[filter] }),
    }))}
  />
);
