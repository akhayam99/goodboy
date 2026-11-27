import type { HiddenModels } from '@goodboy/core/providers';
import { withUnavailableModels } from '../../runtime/models/withUnavailableModels';
import { selectRefusedModels, type RefusedModelsState } from './selectRefusedModels';

type Params = {
  readonly state: RefusedModelsState;
  readonly nowMs: number;
};

export const selectNoAccessModels = ({ state, nowMs }: Params): HiddenModels =>
  withUnavailableModels({ hidden: {}, unavailable: selectRefusedModels({ state, nowMs }) });
