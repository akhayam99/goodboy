import { ANTHROPIC_CATALOG } from './claude/catalog';
import { CLAUDE_PRICES } from './claude/cost';
import { CODEX_CATALOG } from './codex/catalog';
import { CODEX_PRICES } from './codex/cost';
import { CURSOR_CATALOG } from './cursor/catalog';
import { CURSOR_PRICES } from './cursor/cost';
import { GEMINI_CATALOG } from './gemini/catalog';
import { GEMINI_PRICES } from './gemini/cost';

export type ModelPriceSummary = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
};

const MERGED_PRICES: Record<string, { inputPerMtok: number; outputPerMtok: number }> = {
  ...CURSOR_PRICES,
  ...CLAUDE_PRICES,
  ...CODEX_PRICES,
  ...GEMINI_PRICES,
};

for (const model of ANTHROPIC_CATALOG) {
  const price = MERGED_PRICES[model.cliId];
  if (MERGED_PRICES[model.key] == null && price != null) {
    MERGED_PRICES[model.key] = price;
  }
}

for (const model of CURSOR_CATALOG) {
  const price = MERGED_PRICES[model.combos[0]!.slug];
  if (MERGED_PRICES[model.key] == null && price != null) {
    MERGED_PRICES[model.key] = price;
  }
}

for (const model of CODEX_CATALOG) {
  const price = MERGED_PRICES[model.variants[0]!.cliId];
  if (MERGED_PRICES[model.key] == null && price != null) {
    MERGED_PRICES[model.key] = price;
  }
}

for (const model of GEMINI_CATALOG) {
  const price = MERGED_PRICES[model.cliId];
  if (MERGED_PRICES[model.key] == null && price != null) {
    MERGED_PRICES[model.key] = price;
  }
}

export const getModelPrice = (model: string): ModelPriceSummary | null => {
  const price = MERGED_PRICES[model];
  if (price == null) {
    return null;
  }
  return { inputPerMtok: price.inputPerMtok, outputPerMtok: price.outputPerMtok };
};
