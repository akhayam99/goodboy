import { NAMES } from '../../../../shared/utils/names';

export const STUCK_ACTION_LABEL = {
  skipAndGoOn: NAMES.skipStep,
  keepWorking: 'Keep working',
} as const satisfies Record<string, string>;
