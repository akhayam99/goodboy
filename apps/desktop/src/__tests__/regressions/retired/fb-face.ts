import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'overview-or-desk', pattern: /\bOverview or Desk\b/, use: NAMES.overview },
  { id: 'open-on-desk', pattern: /\bOpen on desk\b/i, use: NAMES.desk },
];
