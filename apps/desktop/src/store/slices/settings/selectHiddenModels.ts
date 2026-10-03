import { parseHiddenModels, type HiddenModels } from '@goodboy/core';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'settings'>;
};

export const selectHiddenModels = ({ state }: Params): HiddenModels =>
  parseHiddenModels(state.settings?.[SETTING_HIDDEN_MODELS] ?? null);
