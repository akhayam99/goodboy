import type { ListboxOption } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { projectGlyph } from '../conceptIcons';
import { ICON_SIZE } from '@goodboy/ui';
import { formatCombo } from '../../keyboard/registry';
import type { ProjectMatch } from './projectMatch';
import { projectPickerGroups } from './projectPickerGroups';

type StarToggleParams = {
  readonly project: Project;
};

type Stars = {
  readonly pendingIds: ReadonlyArray<ProjectId>;
  readonly toggle: (params: StarToggleParams) => void;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly recentIds: ReadonlyArray<ProjectId>;
  readonly match?: ProjectMatch | null;
  readonly stars?: Stars;
};

type Group = 'Starred' | 'Recent' | 'All projects';

type OptionParams = {
  readonly project: Project;
  readonly group: Group;
  readonly match: ProjectMatch | null;
  readonly stars: Stars | undefined;
};

type ReasonParams = {
  readonly reason: string;
};

const reasonLine = ({ reason }: ReasonParams): string =>
  `${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;

const optionOf = ({ project, group, match, stars }: OptionParams): ListboxOption<ProjectId> => {
  const Glyph = projectGlyph({ kind: project.kind });
  const baseBranch = project.baseBranch ?? '';
  const hasBaseBranch = group === 'All projects' && baseBranch !== '';
  const isStarred = project.starredAt !== undefined;
  const isMatch = match !== null && match.projectId === project.id;
  return {
    value: project.id,
    label: project.name,
    group,
    leading: <Glyph size={ICON_SIZE.row} aria-hidden />,
    ...(isMatch && { description: reasonLine({ reason: match.reason }) }),
    ...(hasBaseBranch && { meta: baseBranch }),
    ...(stars !== undefined && {
      star: {
        isStarred,
        label: `${isStarred ? 'Unstar' : 'Star'} ${project.name}`,
        tooltip: `${isStarred ? 'Unstar' : 'Keep it on top'} (${formatCombo('cmd+KeyS')})`,
        isBusy: stars.pendingIds.includes(project.id),
        onToggle: () => stars.toggle({ project }),
      },
    }),
  };
};

export const projectPickerOptions = ({
  projects,
  recentIds,
  match = null,
  stars,
}: Params): ReadonlyArray<ListboxOption<ProjectId>> => {
  const { starred, recent, all } = projectPickerGroups({
    projects,
    recentIds: match === null ? recentIds : [match.projectId, ...recentIds],
  });
  return [
    ...starred.map((project) => optionOf({ project, group: 'Starred', match, stars })),
    ...recent.map((project) => optionOf({ project, group: 'Recent', match, stars })),
    ...all.map((project) => optionOf({ project, group: 'All projects', match, stars })),
  ];
};
