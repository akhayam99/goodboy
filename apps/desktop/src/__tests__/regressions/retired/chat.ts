import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'start-a-chat', pattern: /\bStart a chat\b/i, use: NAMES.messageAnAgent },
];
