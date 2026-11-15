import {
  LEAD_PERMISSION_VALUES,
  type LeadPermissionKey,
  type LeadPermissionValue,
} from '@goodboy/core/auto';
import type { LeadPermissionChange } from '../../../store/runtime/auto/level/writeLeadPermission';

type Params = {
  readonly key: LeadPermissionKey;
  readonly value: string | null;
};

type ValueParams<K extends LeadPermissionKey> = {
  readonly key: K;
  readonly value: string | null;
};

const valueOf = <K extends LeadPermissionKey>({
  key,
  value,
}: ValueParams<K>): LeadPermissionValue<K> | null | undefined => {
  if (value === null) {
    return null;
  }
  const values: ReadonlyArray<LeadPermissionValue<K>> = LEAD_PERMISSION_VALUES[key];
  return values.find((allowed) => allowed === value);
};

export const permissionChangeOf = ({ key, value }: Params): LeadPermissionChange | null => {
  switch (key) {
    case 'approvePlan': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'startReaders': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'startWriters': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'push': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'pullRequest': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'dependencies': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'protectedFiles': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'addProject': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    case 'closeWork': {
      const next = valueOf({ key, value });
      return next === undefined ? null : { key, value: next };
    }
    default: {
      const unreachable: never = key;
      return unreachable;
    }
  }
};
