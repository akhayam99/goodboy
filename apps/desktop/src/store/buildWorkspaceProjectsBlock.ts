import type { Project } from '@goodboy/types';
import { starredProjectLines } from './starredProjectLines';

type Params = {
  readonly projects: ReadonlyArray<Project>;
};

export const buildWorkspaceProjectsBlock = ({ projects }: Params): string => {
  if (projects.length === 0) {
    return '';
  }
  return [
    '[workspace-projects]',
    'The workspace has these projects:',
    ...starredProjectLines({
      projects,
      line: ({ project, focus }) => `- ${project.name} (${project.kind})${focus}`,
    }),
    '[/workspace-projects]',
  ].join('\n');
};
