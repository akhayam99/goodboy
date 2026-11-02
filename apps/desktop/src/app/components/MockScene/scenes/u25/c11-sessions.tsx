import { HoverFactsScene } from './c11HoverFactsScene';
import { SessionsScene } from './c11SessionsScene';

const BOARD = { repos: 'fine' } as const;
const BOARD_FILTERED = { isFiltered: true, repos: 'fine' } as const;
const REPOS = { repos: 'attention' } as const;
const EMPTY = { isEmpty: true, repos: 'fine' } as const;

export const U25_C11_SESSIONS_SCENES = {
  'c11-sessions-board': () => <SessionsScene config={BOARD} />,
  'c11-sessions-board-filtered': () => <SessionsScene config={BOARD_FILTERED} />,
  'c11-sessions-repos-attention': () => <SessionsScene config={REPOS} />,
  'c11-sessions-empty': () => <SessionsScene config={EMPTY} />,
  'c11-sessions-hover-facts': HoverFactsScene,
};
