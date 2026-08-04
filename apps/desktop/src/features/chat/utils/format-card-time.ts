import { formatClockTime } from '../../../shared/utils/format';

export const formatCardTime = (isoAt: string): string => {
  return formatClockTime({ iso: isoAt });
};
