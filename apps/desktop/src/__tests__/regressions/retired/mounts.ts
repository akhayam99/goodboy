import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'remove-from-session',
    pattern: /\b[Rr]emoved? (?!link\b)(?:\S+ )?from (?:the |this )?session\b/,
    use: NAMES.unmount,
  },
  {
    id: 'connect-a-repo-or-folder',
    pattern: /\bConnect a repo or folder\b/,
    use: NAMES.chooseAFolder,
  },
];
