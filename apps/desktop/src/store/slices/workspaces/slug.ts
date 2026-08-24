import type { WorkspaceId } from '@goodboy/types';

type SlugParams = {
  readonly name: string;
  readonly id: WorkspaceId;
};

export const workspaceSlug = ({ name, id }: SlugParams): string => {
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${prefix.length === 0 ? 'workspace' : prefix}-${id.slice(0, 8)}`;
};
