import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

export const fmtTimestamp = (ts: string | number): string => formatCompactDateTime({ iso: ts });
