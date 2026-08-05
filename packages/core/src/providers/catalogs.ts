import type { ModelCatalogs } from '@goodboy/types';
import { ANTHROPIC_CATALOG } from './claude/catalog';
import { CODEX_CATALOG } from './codex/catalog';
import { CURSOR_CATALOG } from './cursor/catalog';
import { GEMINI_CATALOG } from './gemini/catalog';
import { OPENCODE_CATALOG } from './opencode/catalog';
import { MOONSHOT_CATALOG } from './moonshot/catalog';
import { OPENROUTER_CATALOG } from './openrouter/catalog';

export const MODEL_CATALOGS = {
  anthropic: ANTHROPIC_CATALOG,
  cursor: CURSOR_CATALOG,
  codex: CODEX_CATALOG,
  gemini: GEMINI_CATALOG,
  opencode: OPENCODE_CATALOG,
  openrouter: OPENROUTER_CATALOG,
  moonshot: MOONSHOT_CATALOG,
} satisfies ModelCatalogs;
