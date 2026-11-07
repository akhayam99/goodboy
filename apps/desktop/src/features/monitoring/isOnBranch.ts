import type { PortRow } from '@goodboy/core/monitoring';
import type { SessionMountView } from '@goodboy/types';
import { portBranchOf } from './portBranchOf';

type Params = {
  readonly row: PortRow;
  readonly branch: string | null;
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

export const isOnBranch = ({ row, branch, sessionMounts }: Params): boolean =>
  branch === null || portBranchOf({ row, sessionMounts }) === branch;
