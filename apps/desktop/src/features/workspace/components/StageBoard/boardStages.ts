import type { SessionStage } from '@goodboy/types';
import { STAGE_ORDER } from '../../../../store/slices/session-view/types';

export const BOARD_STAGES: ReadonlyArray<SessionStage> = (
  Object.entries(STAGE_ORDER) as Array<[SessionStage, number]>
)
  .sort((a, b) => a[1] - b[1])
  .map(([stage]) => stage);
