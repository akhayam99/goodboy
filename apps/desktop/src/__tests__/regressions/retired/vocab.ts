import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'remove-link-from-session',
    pattern: /\bRemove link (?:from this|to) session\b/,
    use: NAMES.removeLinkFromSession,
  },
  { id: 'open-full-bare', pattern: /\bOpen full\b(?! page)/, use: NAMES.openFullPage },
  {
    id: 'couldnt-read-wireframe',
    pattern: /\bCouldn['’]t read wireframe\b/,
    use: NAMES.couldntLoadWireframe,
  },
];
