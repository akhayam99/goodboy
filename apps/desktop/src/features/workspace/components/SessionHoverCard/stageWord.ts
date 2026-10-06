import type { SessionStage } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';

type Params = {
  readonly stage: SessionStage;
};

const STAGE_WORD: Record<SessionStage, string> = {
  attention: NAMES.needsYou,
  running: NAMES.running,
  review: NAMES.inReview,
  building: NAMES.building,
  done: NAMES.done,
};

export const stageWord = ({ stage }: Params): string => STAGE_WORD[stage];
