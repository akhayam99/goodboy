import type { ModelDescriptor } from '@goodboy/types';
import { catalogDescriptor } from '../catalogDescriptor';
import { OPENCODE_CATALOG } from './catalog';

export const OPENCODE_MODELS: ReadonlyArray<ModelDescriptor> = OPENCODE_CATALOG.map((model) =>
  catalogDescriptor({ model }),
);
