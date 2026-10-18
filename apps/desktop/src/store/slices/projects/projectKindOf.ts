import type { Project } from '@goodboy/types';

type Params = {
  readonly project: Pick<Project, 'kind'> | null | undefined;
};

export const projectKindOf = ({ project }: Params): Project['kind'] => project?.kind ?? 'repo';
