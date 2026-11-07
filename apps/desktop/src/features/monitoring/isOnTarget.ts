import type { OwnedMount } from './ownedMountsOf';
import type { MonitoringTarget } from './monitoringTarget';

type Params = {
  readonly mount: OwnedMount | null;
  readonly target: MonitoringTarget | null;
};

export const isOnTarget = ({ mount, target }: Params): boolean => {
  if (target === null) {
    return true;
  }
  return (
    mount !== null &&
    mount.workspaceId === target.workspaceId &&
    mount.projectId === target.projectId &&
    mount.branch === target.branch
  );
};
