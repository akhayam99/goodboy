import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'since-you-left',
    pattern: /\bSince you left\b/,
    use: NAMES.needsYou,
  },
];
