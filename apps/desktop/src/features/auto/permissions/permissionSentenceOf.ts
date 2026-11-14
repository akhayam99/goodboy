import type { LeadPermissions } from '@goodboy/core/auto';
import { formatUsd } from '@goodboy/ui';
import { PERMISSION_ROWS } from './permissionRows';

export type PermissionSentenceParts = Readonly<{
  subject: string;
  asks: ReadonlyArray<string>;
  limit: string;
  closing: string;
}>;

type Params = {
  readonly permissions: LeadPermissions;
  readonly isForLead: boolean;
};

export const permissionSentenceOf = ({
  permissions,
  isForLead,
}: Params): PermissionSentenceParts => {
  const asks = PERMISSION_ROWS.filter(
    (row) => row.asksBefore !== '' && permissions.rows[row.key].value === 'ask',
  ).map((row) => row.asksBefore);
  const { spendLimitUsd } = permissions;
  return {
    subject: isForLead ? 'This Lead asks' : 'A new Lead asks',
    asks,
    limit:
      spendLimitUsd === null ? 'It has no limit.' : `It pauses at ${formatUsd(spendLimitUsd)}.`,
    closing:
      permissions.rows.closeWork.value === 'lead'
        ? 'It closes the work itself.'
        : 'You close the work.',
  };
};
