import type { ModelDescriptor } from '@goodboy/types';
import { catalogDescriptor } from '../catalogDescriptor';
import { MOONSHOT_CATALOG } from './catalog';

export const MOONSHOT_MODELS: ReadonlyArray<ModelDescriptor> = MOONSHOT_CATALOG.map((model) =>
  catalogDescriptor({ model }),
);
