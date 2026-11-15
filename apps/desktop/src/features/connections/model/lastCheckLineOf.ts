import { formatAge } from '../../../shared/utils/time/formatAge';
import type { IntegrationKeyCheck } from '../../../store/slices/integrations/state';

type Params = {
  readonly keyCheck: IntegrationKeyCheck | null;
  readonly nowMs: number;
};

export const lastCheckLineOf = ({ keyCheck, nowMs }: Params): string => {
  if (keyCheck === null) {
    return 'Not checked yet';
  }
  const age = formatAge({ from: keyCheck.checkedAt, now: Math.max(nowMs, keyCheck.checkedAt) });
  return keyCheck.isPresent ? `Checked ${age}` : `Last check failed ${age}`;
};
