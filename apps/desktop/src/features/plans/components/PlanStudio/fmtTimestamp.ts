import { formatCompactDateTime } from '../../../../shared/utils/format';

export const fmtTimestamp = (ts: string | number): string => formatCompactDateTime({ iso: ts });
