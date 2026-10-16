import { ActivityRunScene } from '../ActivityRunScene';
import { SessionAskScene } from '../SessionAskScene';

export const U25_P_0251_SCENES = {
  'ask-reset': () => <SessionAskScene state="followup" />,
  'context-mark-read': () => <ActivityRunScene contextTab="decisions" />,
};
