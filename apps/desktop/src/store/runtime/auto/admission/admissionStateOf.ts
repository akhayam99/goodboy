import {
  isAutoWriterRole,
  type AdmissionPermissions,
  type AutoDelegationRole,
} from '@goodboy/core/auto';

export type AdmissionStateParams = Readonly<{
  permissions: Pick<AdmissionPermissions, 'startReaders' | 'startWriters'>;
  role: AutoDelegationRole;
  isConfirmForced: boolean;
}>;

export const admissionStateOf = ({
  permissions,
  role,
  isConfirmForced,
}: AdmissionStateParams): 'accepted' | 'awaiting_confirm' => {
  const isAsked = isAutoWriterRole({ role })
    ? permissions.startWriters === 'ask'
    : permissions.startReaders === 'ask';
  return isAsked || isConfirmForced ? 'awaiting_confirm' : 'accepted';
};
