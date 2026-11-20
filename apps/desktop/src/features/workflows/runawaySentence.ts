import { MAX_UNATTENDED_TURNS_PER_AGENT } from '../../store/slices/turn/workflowTurnBreaker';

export const RUNAWAY_SENTENCE = `Ran ${MAX_UNATTENDED_TURNS_PER_AGENT} times in an hour with no limit set.`;
