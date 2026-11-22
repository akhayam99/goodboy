import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'an-agent-is-working', pattern: /\bAn agent is working\b/, use: NAMES.running },
];
