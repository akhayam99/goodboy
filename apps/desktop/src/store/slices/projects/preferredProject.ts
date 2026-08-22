import type { Project, WorkspaceProfile } from '@goodboy/types';

const DISCIPLINE_HINTS: Readonly<Record<string, ReadonlyArray<string>>> = {
  frontend: ['web', 'frontend', 'front', 'ui', 'site', 'client', 'app'],
  backend: ['api', 'backend', 'back', 'server', 'service', 'core'],
  fullstack: ['web', 'app', 'api'],
  platform: ['infra', 'platform', 'ops', 'deploy', 'ci'],
  data: ['data', 'analytics', 'etl', 'warehouse', 'pipeline'],
  mobile: ['mobile', 'ios', 'android', 'native'],
  design: ['design', 'web', 'ui', 'site'],
  pm: ['docs', 'product', 'notes'],
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly profile: WorkspaceProfile | undefined;
};

export const preferredProject = ({ projects, profile }: Params): Project | null => {
  const fallback = projects[0] ?? null;
  const discipline = profile?.discipline ?? null;
  if (discipline === null) {
    return fallback;
  }
  const hints = DISCIPLINE_HINTS[discipline] ?? [];
  const match = projects.find((project) =>
    hints.some((hint) => project.name.toLowerCase().includes(hint)),
  );
  return match ?? fallback;
};
