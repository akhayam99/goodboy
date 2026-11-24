import type { ComponentType } from 'react';
import { BoardScene } from './BoardScene';

export const U52_BOARD_SCENES: Readonly<Record<string, ComponentType>> = {
  'u52-board-0-dark': () => <BoardScene theme="dark" cards={0} />,
  'u52-board-0-light': () => <BoardScene theme="light" cards={0} />,
  'u52-board-3-dark': () => <BoardScene theme="dark" cards={3} />,
  'u52-board-3-light': () => <BoardScene theme="light" cards={3} />,
  'u52-board-9-dark': () => <BoardScene theme="dark" cards={9} />,
  'u52-board-9-light': () => <BoardScene theme="light" cards={9} />,
};
