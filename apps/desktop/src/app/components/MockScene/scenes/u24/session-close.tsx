import { SessionCloseScene } from './SessionCloseScene';

export const U24_SESSION_CLOSE_SCENES = {
  'session-close-written': () => <SessionCloseScene isAsking={false} />,
  'session-close-ask': () => <SessionCloseScene isAsking />,
};
