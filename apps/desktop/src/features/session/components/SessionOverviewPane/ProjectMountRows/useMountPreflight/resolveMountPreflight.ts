import { availableBranchName, slugify } from '@goodboy/core';
import type { MountId } from '@goodboy/types';
import { mountDirName } from '../../../../../../store/slices/project-mounts/mountDirName';
import { branchLeaf } from '../../../../../../store/slices/sessions/branchLeaf';
import type { MountPlan } from '../../../../../../store/slices/sessions/mountPlan';

export type MountPreflight = {
  readonly mountId: MountId;
  readonly slug: string;
  readonly branch: string | null;
  readonly baseBranch: string | null;
  readonly targetPath: string;
  readonly renamedFrom: string | null;
};

type Params = {
  readonly plan: MountPlan;
  readonly repoBranches: ReadonlyArray<string>;
};

export const resolveMountPreflight = ({ plan, repoBranches }: Params): MountPreflight => {
  const proposed = {
    mountId: plan.mountId,
    slug: plan.slug,
    branch: plan.adoptedBranch ?? plan.branch,
    baseBranch: plan.baseBranch,
    targetPath: plan.targetPath,
    renamedFrom: null,
  } satisfies MountPreflight;
  if (plan.branch === null || plan.adoptedBranch !== null) {
    return proposed;
  }
  const taken = [...plan.takenBranches, ...repoBranches];
  if (!taken.includes(plan.branch)) {
    return proposed;
  }
  const branch = availableBranchName({ ...plan.naming, taken });
  const slug = slugify({ input: branchLeaf({ branch }), fallback: plan.slug });
  return {
    mountId: plan.mountId,
    slug,
    branch,
    baseBranch: plan.baseBranch,
    targetPath: `${plan.project.rootPath}/.goodboy/worktrees/${mountDirName({
      sessionSlug: slug,
      mountId: plan.mountId,
    })}`,
    renamedFrom: plan.branch,
  };
};
