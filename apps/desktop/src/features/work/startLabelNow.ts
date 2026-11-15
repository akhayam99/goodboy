import { useAppStore } from '../../store';
import { SETTING_WORK_ENABLED } from '../../shared/lib/workSetting';
import { flowRulesOf } from './flowRulesOf';

export const startLabelNow = (): string =>
  flowRulesOf({ isWork: useAppStore.getState().settings[SETTING_WORK_ENABLED] === 'true' })
    .startLabel;
