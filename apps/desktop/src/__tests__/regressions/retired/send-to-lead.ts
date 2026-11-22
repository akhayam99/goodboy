import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'send-to-implementer', pattern: /\bSend to Implementer\b/, use: NAMES.sendToLead },
  {
    id: 'fix-with-the-implementer',
    pattern: /\bFix with the Implementer\b/,
    use: NAMES.sendToLead,
  },
  { id: 'resolve-with-the-lead', pattern: /\bResolve with the Lead\b/, use: NAMES.startNewLead },
];
