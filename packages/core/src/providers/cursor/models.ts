import type { ModelDescriptor } from '@goodboy/types';
import { catalogDescriptor } from '../catalogDescriptor';
import { CURSOR_CATALOG } from './catalog';

export const CURSOR_DEFAULT_MODEL = 'composer-2.5';

export const CURSOR_AUTO_MODEL = 'auto';

export const CURSOR_MODELS: ReadonlyArray<ModelDescriptor> = CURSOR_CATALOG.map((model) =>
  catalogDescriptor({ model }),
);
