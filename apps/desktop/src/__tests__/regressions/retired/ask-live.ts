import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'why-did-the-check-fail',
    pattern: /\bWhy did the check fail\?/,
    use: NAMES.whatAreYouDoing,
  },
  {
    id: 'what-is-happening-right-now',
    pattern: /\bWhat is happening right now\?/,
    use: NAMES.whatAreYouDoing,
  },
  {
    id: 'what-is-left-to-do',
    pattern: /\bWhat is left to do\?/,
    use: NAMES.whatIsLeft,
  },
];
