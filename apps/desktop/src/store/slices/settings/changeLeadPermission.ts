import { tauriDatabase } from '../../../shared/lib/db';
import {
  writeLeadPermission,
  type LeadPermissionChange,
  type LeadPermissionWriteTarget,
} from '../../runtime/auto/level/writeLeadPermission';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

type Params = {
  readonly target: LeadPermissionWriteTarget;
  readonly change: LeadPermissionChange;
};

const writes = createSerialQueue();

export const changeLeadPermission = () => {
  return ({ target, change }: Params): Promise<void> =>
    writes.run({
      key: 'treeId' in target ? target.treeId : target.workspaceId,
      task: () => writeLeadPermission({ db: tauriDatabase, target, change, nowMs: Date.now() }),
    });
};
