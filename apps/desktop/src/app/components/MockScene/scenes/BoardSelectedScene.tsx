import { BoardScene } from './BoardScene';
import { useSelectBoardCards } from './useSelectBoardCards';

export const BoardSelectedScene = () => {
  useSelectBoardCards({ isConfirming: false });
  return <BoardScene />;
};
