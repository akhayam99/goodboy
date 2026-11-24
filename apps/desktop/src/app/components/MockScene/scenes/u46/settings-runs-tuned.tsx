import { useEffect } from 'react';
import { leadPermissionsOf } from '@goodboy/core/auto';
import { useAppStore } from '../../../../../store';
import { EveryRunFrame } from '../audit/EveryRunFrame';

const OPEN_DETAILS_AFTER_MS = 600;

const seedTunedDetails = (): void => {
  const permissions = leadPermissionsOf({
    leadRows: {},
    defaultRows: { push: 'ask', dependencies: 'ask' },
    sessionLevel: null,
    workspaceLevel: 'plan',
    isPlanApprovalOff: false,
    isWorkFlowOn: true,
    spendLimitUsd: null,
  });
  useAppStore.setState({
    readLeadPermissions: async () => permissions,
    changeLeadPermission: async () => undefined,
  });
};

const TunedRuns = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-testid="lead-details-disclosure"] button[aria-expanded]')
        ?.click();
    }, OPEN_DETAILS_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return <EveryRunFrame seed={seedTunedDetails} />;
};

export const U46_SETTINGS_RUNS_TUNED_SCENES = {
  'settings-runs-tuned': () => <TunedRuns />,
};
