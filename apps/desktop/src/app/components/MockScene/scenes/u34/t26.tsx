import { BoardScene } from '../BoardScene';
import { seedLaneWindowBoard } from './seedLaneWindowBoard';
import { seedPrSlotBoard } from './seedPrSlotBoard';

export const U34_T26_SCENES = {
  'u34-t26-pr-slot': () => <BoardScene seed={seedPrSlotBoard} />,
  'u34-t26-lane-window': () => <BoardScene seed={seedLaneWindowBoard} />,
};
