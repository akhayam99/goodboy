import { BoardScene } from './BoardScene';
import { useSelectBoardCards } from './useSelectBoardCards';

export const BoardDeleteConfirmScene = () => {
  useSelectBoardCards({ isConfirming: true });
  return <BoardScene />;
};
