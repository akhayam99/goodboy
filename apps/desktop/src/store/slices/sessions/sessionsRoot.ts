import type { Workspace } from '@goodboy/types';

type Params = {
  readonly workspace: Workspace;
};

export const resolveSessionsRoot = ({ workspace }: Params): string =>
  workspace.sessionsRoot ?? `~/.goodboy/sessions/${workspace.slug}`;
