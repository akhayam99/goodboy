import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'open-in-session', pattern: /\bOpen in session\b/, use: NAMES.needsYou },
];
