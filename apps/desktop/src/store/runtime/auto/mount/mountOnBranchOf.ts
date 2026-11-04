import type { ProjectId, SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projectId: ProjectId;
  readonly branch: string | null;
};

export type MountOnBranch =
  | Readonly<{ kind: 'match'; mount: SessionProjectMount }>
  | Readonly<{ kind: 'elsewhere'; mount: SessionProjectMount }>
  | Readonly<{ kind: 'none' }>;

export const mountOnBranchOf = ({ mounts, projectId, branch }: Params): MountOnBranch => {
  const ofProject = mounts.filter((mount) => mount.projectId === projectId);
  const first = ofProject[0];
  if (first === undefined) {
    return { kind: 'none' };
  }
  if (branch === null) {
    return { kind: 'match', mount: first };
  }
  const onBranch = ofProject.find((mount) => mount.branch === branch);
  if (onBranch !== undefined) {
    return { kind: 'match', mount: onBranch };
  }
  return { kind: 'elsewhere', mount: first };
};
