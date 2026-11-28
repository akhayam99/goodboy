import type { OverlapGroup } from './overlapGroupOf';

export type OverlapCaution = Readonly<{
  fileCount: number;
  otherMountId: string;
  otherBranch: string;
}>;

type Params = {
  readonly group: OverlapGroup | null;
  readonly readyMountIds: ReadonlySet<string>;
  readonly isSettled: boolean;
};

export const overlapCautionOf = ({
  group,
  readyMountIds,
  isSettled,
}: Params): OverlapCaution | null => {
  if (group === null || isSettled) {
    return null;
  }
  const other = group.steps.find((step) => !step.isOwn && readyMountIds.has(step.mount.mountId));
  if (other === undefined) {
    return null;
  }
  return {
    fileCount: other.sharedPaths.length,
    otherMountId: other.mount.mountId,
    otherBranch: other.mount.branch,
  };
};
