import { formatAge } from '../../../shared/utils/time/formatAge';
import type { ToolCheck } from '../../../store/slices/integrations/state';

type Params = {
  readonly check: ToolCheck | undefined;
  readonly nowMs: number;
};

export const lastCheckLineOf = ({ check, nowMs }: Params): string => {
  if (check === undefined || check.checkedAtMs === null) {
    return 'Not checked yet';
  }
  const age = formatAge({ from: check.checkedAtMs, now: Math.max(nowMs, check.checkedAtMs) });
  return check.result === 'failed' ? `Last check failed ${age}` : `Checked ${age}`;
};
