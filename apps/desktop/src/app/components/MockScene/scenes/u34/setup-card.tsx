import { BoardShellScene } from '../BoardShellScene';
import { SessionsScene } from '../u25/c11SessionsScene';

const EMPTY = { isEmpty: true, repos: 'fine' } as const;

export const U34_SETUP_CARD_SCENES = {
  'u34-u27-foot-board': BoardShellScene,
  'u34-u27-empty-board': () => <SessionsScene config={EMPTY} />,
};
