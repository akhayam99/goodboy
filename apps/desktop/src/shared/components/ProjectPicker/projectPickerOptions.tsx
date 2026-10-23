import type { ListboxOption } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { ICON_SIZE, projectGlyph } from '../conceptIcons';
import { projectPickerGroups } from './projectPickerGroups';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly suggestedIds: ReadonlyArray<ProjectId>;
};

type OptionParams = {
  readonly project: Project;
  readonly group: 'Suggested' | 'All folders';
};

const optionOf = ({ project, group }: OptionParams): ListboxOption<ProjectId> => {
  const Glyph = projectGlyph({ kind: project.kind });
  const baseBranch = project.baseBranch ?? '';
  const hasBaseBranch = group === 'All folders' && baseBranch !== '';
  return {
    value: project.id,
    label: project.name,
    group,
    leading: <Glyph size={ICON_SIZE.row} aria-hidden />,
    ...(hasBaseBranch && { meta: baseBranch }),
  };
};

export const projectPickerOptions = ({
  projects,
  suggestedIds,
}: Params): ReadonlyArray<ListboxOption<ProjectId>> => {
  const { suggested, all } = projectPickerGroups({ projects, suggestedIds });
  return [
    ...suggested.map((project) => optionOf({ project, group: 'Suggested' })),
    ...all.map((project) => optionOf({ project, group: 'All folders' })),
  ];
};
