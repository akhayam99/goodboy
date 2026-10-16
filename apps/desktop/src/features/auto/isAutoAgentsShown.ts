import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';
import { autoExperimentSettings } from './autoExperimentSettings';
import { autoRootsOf } from './autoRootsOf';
import { isAutoStartEnabled } from './isAutoStartEnabled';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const isAutoAgentsShown = ({ state, sessionId }: Params): boolean =>
  isAutoStartEnabled({
    settings: autoExperimentSettings({ raw: state.settings[SETTING_AUTO_EXPERIMENT] }),
  }) ||
  autoRootsOf({
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    kindOverride: state.agentKindOverride,
  }).length > 0;
