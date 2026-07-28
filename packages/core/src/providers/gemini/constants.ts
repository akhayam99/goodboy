import type { ModelDescriptor } from '@goodboy/types';
import { catalogDescriptor } from '../catalogDescriptor';
import { GEMINI_CATALOG } from './catalog';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';
export const GEMINI_CHEAP_MODEL = 'gemini-3.5-flash';

export const GEMINI_MODELS: ReadonlyArray<ModelDescriptor> = GEMINI_CATALOG.map((model) =>
  catalogDescriptor({ model }),
);
