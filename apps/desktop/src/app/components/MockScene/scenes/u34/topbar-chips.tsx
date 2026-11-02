import { BoardShellScene } from '../BoardShellScene';
import { TopbarStatesScene } from '../u23/topbar/TopbarStatesScene';

export const U34_TOPBAR_CHIPS_SCENES = {
  'u34-u55-topbar-running': () => <TopbarStatesScene Inner={BoardShellScene} providerCount={3} />,
};
