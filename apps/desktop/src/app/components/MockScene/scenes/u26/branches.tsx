import { BranchesBoardScene } from './BranchesBoardScene';
import { BranchesCardsScene } from './BranchesCardsScene';

export const U26_BRANCHES_SCENES = {
  'u26-board-multi-dark': () => <BranchesBoardScene theme="dark" />,
  'u26-board-multi-light': () => <BranchesBoardScene theme="light" />,
  'u26-cards-inset-dark': () => <BranchesCardsScene theme="dark" />,
  'u26-cards-inset-light': () => <BranchesCardsScene theme="light" />,
};
