import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'lead-waits-for-you', pattern: /\bWaits for you\b/, use: NAMES.needsYou },
  { id: 'lead-resting', pattern: /^Resting$/, use: NAMES.idle },
  { id: 'lead-plan-is-ready', pattern: /\bPlan is ready\b/, use: NAMES.needsApproval },
  { id: 'run-halted', pattern: /\bRun halted\b/, use: NAMES.needsYou },
  { id: 'no-pr', pattern: /\bNo PR\b/, use: NAMES.noPullRequest },
  {
    id: 'auto-lead-sentence',
    pattern: /\bAuto (?:is blocked|could not|didn't|is not running|kept trying)\b/,
    use: NAMES.lead,
  },
];
