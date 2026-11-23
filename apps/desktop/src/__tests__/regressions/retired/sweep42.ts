import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'send-to-the-agent',
    pattern: /\bSend to the agent\b/,
    use: NAMES.addToMessage,
  },
];
