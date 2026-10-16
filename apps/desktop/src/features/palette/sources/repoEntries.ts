import { ArrowDownToLine } from 'lucide-react';
import type { Project, ProjectId, WorkspaceGitStatus } from '@goodboy/types';
import type { PaletteEntry } from '../types';

type RepoParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly statuses: Readonly<Record<ProjectId, WorkspaceGitStatus>>;
  readonly pull: (projects: ReadonlyArray<Project>) => void;
};

const NO_BASE_LABEL = 'the default branch';

const baseOf = (project: Project): string => {
  const named = project.baseBranch?.trim() ?? '';
  return named === '' ? NO_BASE_LABEL : named;
};

type DetailParams = {
  readonly project: Project;
  readonly statuses: Readonly<Record<ProjectId, WorkspaceGitStatus>>;
};

const detailOf = ({ project, statuses }: DetailParams): string => {
  const base = baseOf(project);
  const status = statuses[project.id];
  const branch = status?.state === 'ready' ? status.branch : null;
  if (branch === null || branch === undefined || branch === base) {
    return base;
  }
  return `${base} · checkout stays on ${branch}`;
};

export const repoEntries = ({
  projects,
  statuses,
  pull,
}: RepoParams): ReadonlyArray<PaletteEntry> => {
  const repos = projects.filter((project) => project.kind === 'repo');
  if (repos.length === 0) {
    return [];
  }
  const rows: PaletteEntry[] = repos.map((project) => ({
    key: `action:pull-base:${project.id}`,
    label: `Pull ${baseOf(project)} in ${project.name}`,
    secondary: ['Pull', 'Update main', 'Fetch main'],
    kind: 'action',
    group: 'action',
    icon: ArrowDownToLine,
    detail: detailOf({ project, statuses }),
    run: () => pull([project]),
  }));
  if (repos.length < 2) {
    return rows;
  }
  return [
    {
      key: 'action:pull-base:all',
      label: 'Pull main in all linked repos',
      secondary: ['Pull', 'Update main', 'Fetch main', 'Pull all'],
      kind: 'action',
      group: 'action',
      icon: ArrowDownToLine,
      run: () => pull(repos),
    },
    ...rows,
  ];
};
