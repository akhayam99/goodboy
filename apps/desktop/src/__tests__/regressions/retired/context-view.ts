import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'what-the-agents-know',
    pattern: /\bWhat the agents know\b/,
    use: NAMES.whatGoodboySends,
  },
];
