import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'go-to-submenu',
    pattern: /^Go to$/,
    use: NAMES.open,
    allowedPaths: /features[/](?:palette|settings|wireframes)[/]/,
  },
  { id: 'open-the-full-log', pattern: /\bOpen the full log\b/, use: NAMES.open },
];
