import { useAppStore } from '../../../store';
import { flowWordOf, type FlowWord } from '../../lib/flowWordOf';
import { SETTING_WORK_ENABLED } from '../../lib/workSetting';

export const useLoadedFlowWord = (): FlowWord =>
  flowWordOf({ isWork: useAppStore((state) => state.settings[SETTING_WORK_ENABLED] === 'true') });
