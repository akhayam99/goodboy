import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'send-to-the-agent',
    pattern: /\bSend to the agent\b/,
    use: NAMES.addToMessage,
  },
  {
    id: 'detach-anyway',
    pattern: /\bDetach anyway\b/,
    use: 'Unmount anyway',
  },
  {
    id: 'asleep-may-reload-when-opened',
    pattern: /\bAsleep, may reload when opened\b/,
    use: 'Asleep, opens at its address and may reload',
  },
];
