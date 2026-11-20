import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'close-the-drawer', pattern: /\bClose the [Dd]rawer\b/, use: NAMES.closeThePanel },
  {
    id: 'close-the-nearest-thing',
    pattern: /\bClose the nearest thing\b/,
    use: NAMES.closeOrGoBack,
  },
];
