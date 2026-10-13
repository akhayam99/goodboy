import { ActivityRunScene } from '../ActivityRunScene';
import { SessionAskScene } from '../SessionAskScene';
import { MountsScene } from '../MountsScene';

export const U25_P_0251_SCENES = {
  'mount-big-stats': () => <MountsScene variant="big-stats" />,
  'ask-reset': () => <SessionAskScene state="followup" />,
  'context-mark-read': () => <ActivityRunScene contextTab="decisions" />,
};
