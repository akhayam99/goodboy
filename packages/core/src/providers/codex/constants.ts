import type { ModelDescriptor } from '@goodboy/types';
import { catalogDescriptor } from '../catalogDescriptor';
import { CODEX_CATALOG } from './catalog';

export const CODEX_DEFAULT_MODEL = 'gpt-5.6-sol';
export const CODEX_CHEAP_MODEL = 'gpt-5.4-mini';

export const CODEX_MODELS: ReadonlyArray<ModelDescriptor> = CODEX_CATALOG.map((model) =>
  catalogDescriptor({ model }),
);
