import type { LeadPermissions } from '@goodboy/core/auto';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  readLeadPermissions,
  type LeadPermissionsTarget,
} from '../../runtime/auto/level/readLeadPermissions';

type Params = {
  readonly target: LeadPermissionsTarget;
  readonly isWorkFlowOn: boolean;
};

export const readLeadPermissionsAction = () => {
  return ({ target, isWorkFlowOn }: Params): Promise<LeadPermissions> =>
    readLeadPermissions({ db: tauriDatabase, target, isWorkFlowOn });
};
