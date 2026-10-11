import { ScriptsLiveIdleScene } from './ScriptsLiveIdleScene';
import { ScriptsLivePortBusyScene } from './ScriptsLivePortBusyScene';
import { ScriptsLiveRunningScene } from './ScriptsLiveRunningScene';
import { ScriptsLiveSuggestedScene } from './ScriptsLiveSuggestedScene';

export const U24_SCRIPTS_LIVE_SCENES = {
  'scripts-live-idle': ScriptsLiveIdleScene,
  'scripts-live-running': ScriptsLiveRunningScene,
  'scripts-live-portbusy': ScriptsLivePortBusyScene,
  'scripts-live-suggested': ScriptsLiveSuggestedScene,
};
