import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'report-this-alone',
    pattern: /\bReport this\b(?! (?:crash|error|freeze)\b)/,
    use: NAMES.reportThisError,
  },
  {
    id: 'a-fix-run-needs-you',
    pattern: /\bA fix run needs you\b/,
    use: NAMES.needsYou,
  },
];
