import { SessionAskScene } from '../../SessionAskScene';
import { U24_EXPLORE_CHANGES_SCENES } from '../../u24/explore-changes';
import { U24_SCRIPTS_LIVE_SCENES } from '../../u24/scripts-live';
import { U25_B_TERMINAL_DRAWER_SCENES } from '../../u25/b-terminal-drawer';
import { U28_RAIL_ORDER_BADGE_SCENES } from '../../u28/rail-order-badge';
import { U26S_EXPLORE_SCENES } from '../explore/ExploreScene';

export const U36_TOOL_HEADS_SCENES = {
  'u36-p18-tools-column': U28_RAIL_ORDER_BADGE_SCENES['session-tools-order'],
  'u36-p18-explore-head': U26S_EXPLORE_SCENES['u26s-explore-rows'],
  'u36-p18-explore-changed': U24_EXPLORE_CHANGES_SCENES['explore-changedfilter'],
  'u36-p18-explore-empty': U26S_EXPLORE_SCENES['u26s-explore-empty'],
  'u36-p18-terminal-head': U25_B_TERMINAL_DRAWER_SCENES['terminal-drawer-session'],
  'u36-p18-scripts-suggested': U24_SCRIPTS_LIVE_SCENES['scripts-live-suggested'],
  'u36-p18-ask-answer': () => <SessionAskScene state="answer" />,
};
