import { AUTO_RESTING_PHASES, type AutoPhase } from '@goodboy/db';
import { isAutoTreeActive } from './autoTreePhases';

type Params = {
  readonly phase: AutoPhase;
};

export const isAutoTreeResting = ({ phase }: Params): boolean =>
  !isAutoTreeActive({ phase }) || AUTO_RESTING_PHASES.some((resting) => resting === phase);
