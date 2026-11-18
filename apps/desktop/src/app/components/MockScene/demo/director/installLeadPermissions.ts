import { leadPermissionsOf } from '@goodboy/core/auto';
import type { AppStore } from '../../../../../store/store';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

const LEAD_PERMISSIONS = leadPermissionsOf({
  leadRows: {},
  defaultRows: {},
  sessionLevel: 'plan',
  workspaceLevel: null,
  isPlanApprovalOff: false,
  isWorkFlowOn: true,
  spendLimitUsd: 10,
});

export const installLeadPermissions = ({ store }: Params): void => {
  const readLeadPermissions: AppStore['readLeadPermissions'] = async () => LEAD_PERMISSIONS;
  store.setState({ readLeadPermissions });
};
