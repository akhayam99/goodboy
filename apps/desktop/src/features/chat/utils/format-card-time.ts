import { formatClockTime } from '../../../shared/utils/formatClockTime';

export const formatCardTime = (isoAt: string): string => {
  return formatClockTime({ iso: isoAt });
};
