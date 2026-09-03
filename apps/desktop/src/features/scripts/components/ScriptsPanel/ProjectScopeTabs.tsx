import { ScrollFade, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';

export type ProjectFilter = 'all' | ProjectId;

type Props = {
  readonly options: ReadonlyArray<SegmentedTabOption<ProjectFilter>>;
  readonly value: ProjectFilter;
  readonly onChange: (value: ProjectFilter) => void;
};

export const ProjectScopeTabs = ({ options, value, onChange }: Props) => (
  <ScrollFade
    className="w-full"
    viewportClassName="overflow-x-auto overflow-y-hidden"
    fadeSize={24}
  >
    <SegmentedTabs
      ariaLabel="Filter scripts by project"
      options={options}
      value={value}
      onChange={onChange}
      size="sm"
      className="whitespace-nowrap"
    />
  </ScrollFade>
);
