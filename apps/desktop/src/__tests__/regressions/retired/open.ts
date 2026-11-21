import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'open-page', pattern: /\bOpen page\b/, use: NAMES.openFullPage },
  { id: 'close-runs', pattern: /\bClose runs\b/, use: NAMES.close },
  { id: 'close-the-item', pattern: /\bClose the item\b/, use: NAMES.close },
  { id: 'back-to-current', pattern: /\bBack to current\b/, use: NAMES.close },
  { id: 'open-runs-lowercase', pattern: /^Open runs$/, use: NAMES.openInRuns },
  { id: 'open-decisions', pattern: /^Open decisions$/, use: NAMES.openInContext },
  { id: 'open-explanations', pattern: /^Open explanations$/, use: NAMES.openInContext },
];
