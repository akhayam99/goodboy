import type { ProviderPolicyState } from '@goodboy/types';

export const POLICY_STATE_LABEL: Readonly<Record<ProviderPolicyState, string>> = {
  on: 'On',
  backup: 'Backup only',
  off: 'Off',
};
