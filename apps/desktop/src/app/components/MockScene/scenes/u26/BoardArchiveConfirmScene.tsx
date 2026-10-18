import { BoardScene } from '../BoardScene';
import { useSelectBoardCards } from '../useSelectBoardCards';

export const BoardArchiveConfirmScene = () => {
  useSelectBoardCards({ isConfirming: true, verb: 'Archive' });
  return <BoardScene />;
};
