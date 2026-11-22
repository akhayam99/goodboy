import { useContext } from 'react';
import { BoardContext, type BoardContextValue } from '../BoardContext';

export const useBoardContext = (): BoardContextValue => {
  const value = useContext(BoardContext);
  if (value === null) {
    throw new Error('The board row needs its board.');
  }
  return value;
};
