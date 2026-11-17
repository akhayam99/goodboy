import {
  LEAD_PERMISSION_KEYS,
  LEAD_PERMISSION_PRESETS,
  type LeadPermissions,
} from '@goodboy/core/auto';

type Params = {
  readonly permissions: LeadPermissions;
};

export const leadDetailsDifferOf = ({ permissions }: Params): number =>
  LEAD_PERMISSION_KEYS.filter(
    (key) => permissions.rows[key].value !== LEAD_PERMISSION_PRESETS[permissions.level][key],
  ).length;
