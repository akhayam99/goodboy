import type { ProjectId } from '@goodboy/types';

type Params = {
  readonly mount: {
    readonly projectId: ProjectId;
    readonly projectName: string;
    readonly branch: string;
  };
  readonly siblings: ReadonlyArray<{ readonly projectId: ProjectId }>;
};

export const mountLabelOf = ({ mount, siblings }: Params): string => {
  const sharedCount = siblings.filter((sibling) => sibling.projectId === mount.projectId).length;
  return sharedCount >= 2 ? mount.branch : mount.projectName;
};
