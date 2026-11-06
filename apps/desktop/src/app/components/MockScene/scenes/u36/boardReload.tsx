import type { ComponentType } from 'react';
import { BoardFactsScene } from './BoardFactsScene';
import { PlansQuestionScene } from './PlansQuestionScene';

export const U36_BOARD_RELOAD_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-p3-board-facts-failed-light': () => <BoardFactsScene theme="light" />,
  'u36-p3-board-facts-failed-dark': () => <BoardFactsScene theme="dark" />,
  'u36-p3-plans-tester-question-light': () => <PlansQuestionScene theme="light" />,
  'u36-p3-plans-tester-question-dark': () => <PlansQuestionScene theme="dark" />,
};
