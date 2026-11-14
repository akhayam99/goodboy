import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { SETTING_WORK_ENABLED } from '../../../shared/lib/workSetting';
import { dispatchAfterNavigation } from '../../actions/dispatchAfterNavigation';
import { flowRulesOf } from '../../work/flowRulesOf';
import { openStartWork } from '../../work/openStartWork';
import { askWithFileOf } from './askWithFileOf';
import type { StartRunFile } from './startRunFileOf';
import { startRunEventName } from './startRunEventName';

type Params = {
  readonly sessionId: SessionId;
  readonly text?: string;
  readonly file?: StartRunFile | null;
};

export const openStartRun = ({ sessionId, text = '', file = null }: Params): void => {
  const state = useAppStore.getState();
  const isWork = state.settings[SETTING_WORK_ENABLED] === 'true';
  if (flowRulesOf({ isWork }).shouldStartOpenComposer) {
    openStartWork({
      seed: {
        sessionId,
        projectId: null,
        branch: null,
        text:
          file === null
            ? text
            : askWithFileOf({
                ask: text,
                relPath: file.relPath,
                absolutePath: file.absolutePath,
              }),
      },
    });
    return;
  }
  state.navigate({ to: lensPlace({ state, sessionId, lens: 'workflows' }) });
  dispatchAfterNavigation({
    name: startRunEventName({ sessionId }),
    detail: file === null ? { text } : { text, file },
  });
};
