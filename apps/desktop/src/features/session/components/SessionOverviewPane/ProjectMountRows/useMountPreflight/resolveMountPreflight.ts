import { availableBranchName, slugify } from '@goodboy/core/slug';
import type { MountId } from '@goodboy/types';
import { branchLeaf } from '../../../../../../store/slices/sessions/branchLeaf';
import type { MountPlan } from '../../../../../../store/slices/sessions/mountPlan';

export type MountPreflight = {
  readonly mountId: MountId;
  readonly slug: string;
  readonly branch: string | null;
  readonly baseBranch: string | null;
  readonly targetPath: string;
  readonly renamedFrom: string | null;
  readonly isExistingBranch: boolean;
  readonly isNamedByGoal: boolean;
  readonly goalBranches: ReadonlyArray<string>;
  readonly checkedOutAt: string | null;
};

type Params = {
  readonly plan: MountPlan;
  readonly repoBranches: ReadonlyArray<string>;
  readonly checkedOutAt?: string | null;
};

export const resolveMountPreflight = ({
  plan,
  repoBranches,
  checkedOutAt = null,
}: Params): MountPreflight => {
  const proposed = {
    mountId: plan.mountId,
    slug: plan.slug,
    branch: plan.adoptedBranch ?? plan.branch,
    baseBranch: plan.baseBranch,
    targetPath: plan.targetPath,
    renamedFrom: null,
    isExistingBranch: plan.adoptedBranch !== null,
    isNamedByGoal: plan.isAdoptedFromGoal,
    goalBranches: plan.goalBranches,
    checkedOutAt,
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
  return { ...proposed, slug, branch, renamedFrom: plan.branch };
};
