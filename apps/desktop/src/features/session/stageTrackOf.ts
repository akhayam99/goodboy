import type { Tone } from '@goodboy/ui';
import type { SessionStage } from '@goodboy/types';
import { ARCHIVED_LANE, STAGE_TONE } from './session-stage';

export type StageTrack = {
  readonly tone: Tone;
  readonly isBreathing: boolean;
};

type Params = {
  readonly stage: SessionStage;
  readonly isArchived: boolean;
};

export const stageTrackOf = ({ stage, isArchived }: Params): StageTrack => {
  if (isArchived) {
    return { tone: ARCHIVED_LANE.tone, isBreathing: false };
  }
  return { tone: STAGE_TONE[stage], isBreathing: stage === 'running' };
};
