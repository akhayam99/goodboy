import type { Project, ProjectId } from '@goodboy/types';
import { shouldGroupStarred } from '../../../../../shared/utils/shouldGroupStarred';
import { projectPickerGroups } from '../../../../../shared/components/ProjectPicker/projectPickerGroups';

export type MountPickerGroup = {
  readonly key: string;
  readonly label: string | null;
  readonly projects: ReadonlyArray<Project>;
};

type Params = {
  readonly filtered: ReadonlyArray<Project>;
  readonly total: number;
  readonly recentIds: ReadonlyArray<ProjectId>;
  readonly requestedIds: ReadonlyArray<ProjectId>;
  readonly isQueryEmpty: boolean;
};

const ASKED_LABEL = 'Asked by an agent';
const WORKSPACE_LABEL = 'In the workspace';

export const mountPickerGroups = ({
  filtered,
  total,
  recentIds,
  requestedIds,
  isQueryEmpty,
}: Params): ReadonlyArray<MountPickerGroup> => {
  const asked = isQueryEmpty ? filtered.filter((project) => requestedIds.includes(project.id)) : [];
  const rest = filtered.filter((project) => !asked.includes(project));
  const { starred, recent, all } = projectPickerGroups({ projects: rest, recentIds });
  const isGrouped =
    isQueryEmpty && shouldGroupStarred({ starredCount: starred.length + recent.length, total });
  const askedGroup = { key: 'asked', label: ASKED_LABEL, projects: asked };
  const groups = isGrouped
    ? [
        askedGroup,
        { key: 'starred', label: 'Starred', projects: starred },
        { key: 'recent', label: 'Recent', projects: recent },
        { key: 'other', label: 'Other projects', projects: all },
      ]
    : [
        askedGroup,
        {
          key: 'all',
          label: asked.length === 0 ? null : WORKSPACE_LABEL,
          projects: [...starred, ...recent, ...all],
        },
      ];
  return groups.filter((group) => group.projects.length > 0);
};
