import type { AdmissionPermissions } from './admission';

type Params = Readonly<{
  isPlanApprovalRequired: boolean;
  permissions: Pick<AdmissionPermissions, 'approvePlan'>;
}>;

export const isAdmissionPlanGateOn = ({ isPlanApprovalRequired, permissions }: Params): boolean =>
  isPlanApprovalRequired && permissions.approvePlan === 'ask';
