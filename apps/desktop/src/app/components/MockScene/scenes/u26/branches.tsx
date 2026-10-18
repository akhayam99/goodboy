import { BranchesBoardScene } from './BranchesBoardScene';
import { BranchesCardsScene } from './BranchesCardsScene';
import { BranchesSessionsScene } from './BranchesSessionsScene';

export const U26_BRANCHES_SCENES = {
  'u26-sessions-base-dark': () => <BranchesSessionsScene theme="dark" isMulti={false} />,
  'u26-sessions-base-light': () => <BranchesSessionsScene theme="light" isMulti={false} />,
  'u26-sessions-multi-dark': () => <BranchesSessionsScene theme="dark" isMulti />,
  'u26-sessions-multi-light': () => <BranchesSessionsScene theme="light" isMulti />,
  'u26-board-multi-dark': () => <BranchesBoardScene theme="dark" />,
  'u26-board-multi-light': () => <BranchesBoardScene theme="light" />,
  'u26-cards-inset-dark': () => <BranchesCardsScene theme="dark" />,
  'u26-cards-inset-light': () => <BranchesCardsScene theme="light" />,
};
