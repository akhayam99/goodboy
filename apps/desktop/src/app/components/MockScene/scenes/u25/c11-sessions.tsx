import { HoverFactsScene } from './c11HoverFactsScene';
import { SessionsScene } from './c11SessionsScene';

const BOARD = { view: 'board', repos: 'fine' } as const;
const LIST = { view: 'list', repos: 'fine' } as const;
const GROUPED = { view: 'list', group: 'stage', repos: 'fine' } as const;
const FILTERED = { view: 'list', isFiltered: true, repos: 'fine' } as const;
const BOARD_FILTERED = { view: 'board', isFiltered: true, repos: 'fine' } as const;
const REPOS = { view: 'board', repos: 'attention' } as const;
const EMPTY = { view: 'board', isEmpty: true, repos: 'fine' } as const;

export const U25_C11_SESSIONS_SCENES = {
  'c11-sessions-board': () => <SessionsScene config={BOARD} />,
  'c11-sessions-board-filtered': () => <SessionsScene config={BOARD_FILTERED} />,
  'c11-sessions-list': () => <SessionsScene config={LIST} />,
  'c11-sessions-list-grouped': () => <SessionsScene config={GROUPED} />,
  'c11-sessions-list-filtered': () => <SessionsScene config={FILTERED} />,
  'c11-sessions-repos-attention': () => <SessionsScene config={REPOS} />,
  'c11-sessions-empty': () => <SessionsScene config={EMPTY} />,
  'c11-sessions-hover-facts': HoverFactsScene,
};
