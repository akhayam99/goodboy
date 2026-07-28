import type { ModelDescriptor } from '@goodboy/types';
import { catalogDescriptor } from '../catalogDescriptor';
import { OPENROUTER_CATALOG } from './catalog';

export const OPENROUTER_MODELS: ReadonlyArray<ModelDescriptor> = OPENROUTER_CATALOG.map((model) =>
  catalogDescriptor({ model }),
);
