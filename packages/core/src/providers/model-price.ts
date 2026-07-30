import { CLAUDE_PRICES } from './claude/cost';
import { CODEX_PRICES } from './codex/cost';
import { CURSOR_PRICES } from './cursor/cost';
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

export const getModelPrice = (model: string): ModelPriceSummary | null => {
  const price = MERGED_PRICES[model];
  if (price == null) {
    return null;
  }
  return { inputPerMtok: price.inputPerMtok, outputPerMtok: price.outputPerMtok };
};
