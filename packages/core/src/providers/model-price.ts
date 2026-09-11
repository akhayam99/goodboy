import type { ModelKey, ProviderId } from '@goodboy/types';
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

type ProviderPriceParams = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

type RawPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
};

type TableLookupParams = {
  readonly table: Readonly<Record<string, RawPrice>>;
  readonly ids: ReadonlyArray<string>;
};

const firstPriceIn = ({ table, ids }: TableLookupParams): ModelPriceSummary | null => {
  for (const id of ids) {
    const price = table[id];
    if (price != null) {
      return { inputPerMtok: price.inputPerMtok, outputPerMtok: price.outputPerMtok };
    }
  }
  return null;
};

const ANTHROPIC_PRICE_IDS: ReadonlyMap<string, string> = new Map(
  ANTHROPIC_CATALOG.map((model) => [model.key, model.cliId]),
);

const CURSOR_PRICE_IDS: ReadonlyMap<string, string> = new Map(
  CURSOR_CATALOG.map((model) => [model.key, model.combos[0]!.slug]),
);

const CODEX_PRICE_IDS: ReadonlyMap<string, string> = new Map(
  CODEX_CATALOG.map((model) => [model.key, model.variants[0]!.cliId]),
);

const GEMINI_PRICE_IDS: ReadonlyMap<string, string> = new Map(
  GEMINI_CATALOG.map((model) => [model.key, model.cliId]),
);

type CandidateIdsParams = {
  readonly map: ReadonlyMap<string, string>;
  readonly model: ModelKey;
};

const candidateIds = ({ map, model }: CandidateIdsParams): ReadonlyArray<string> => {
  const mapped = map.get(model);
  if (mapped == null) {
    return [model];
  }
  return [model, mapped];
};

export const getProviderModelPrice = ({
  provider,
  model,
}: ProviderPriceParams): ModelPriceSummary | null => {
  switch (provider) {
    case 'anthropic':
      return firstPriceIn({
        table: CLAUDE_PRICES,
        ids: candidateIds({ map: ANTHROPIC_PRICE_IDS, model }),
      });
    case 'cursor':
      return firstPriceIn({
        table: CURSOR_PRICES,
        ids: candidateIds({ map: CURSOR_PRICE_IDS, model }),
      });
    case 'codex':
      return firstPriceIn({
        table: CODEX_PRICES,
        ids: candidateIds({ map: CODEX_PRICE_IDS, model }),
      });
    case 'gemini':
      return firstPriceIn({
        table: GEMINI_PRICES,
        ids: candidateIds({ map: GEMINI_PRICE_IDS, model }),
      });
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return null;
    default: {
      const exhaustive: never = provider;
      throw new Error(`unknown provider: ${String(exhaustive)}`);
    }
  }
};
