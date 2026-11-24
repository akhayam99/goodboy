import type { SessionStage } from '@goodboy/types';
import { BOARD_STAGES } from './boardStages';

export type BoardLaneSpec =
  { readonly kind: 'stage'; readonly stage: SessionStage } | { readonly kind: 'archived' };

export const BOARD_LANE_SPECS: ReadonlyArray<BoardLaneSpec> = [
  ...BOARD_STAGES.filter((stage) => stage !== 'attention').map((stage): BoardLaneSpec => ({
    kind: 'stage',
    stage,
  })),
  { kind: 'archived' },
];
