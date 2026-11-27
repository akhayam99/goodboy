import type { HiddenModels } from '@goodboy/core/providers';
import type { AppStore } from '../../store';
import { withUnavailableModels } from '../../runtime/models/withUnavailableModels';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { selectRefusedModels, type RefusedModelsState } from './selectRefusedModels';

type Params = {
  readonly state: Pick<AppStore, 'settings'> & RefusedModelsState;
  readonly nowMs?: number;
};

export const selectBlockedModels = ({ state, nowMs = Date.now() }: Params): HiddenModels =>
  withUnavailableModels({
    hidden: selectHiddenModels({ state }),
    unavailable: selectRefusedModels({ state, nowMs }),
  });
