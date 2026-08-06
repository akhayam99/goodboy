import type { ProviderName } from '@goodboy/types';
import { CODEX_PRICES } from './codex/cost';
import { GEMINI_PRICES } from './gemini/cost';

export type CostCoverage = 'measured' | 'approximate' | 'unpriced';

type Params = {
  readonly provider: ProviderName;
  readonly model: string;
};

export const costCoverage = ({ provider, model }: Params): CostCoverage => {
  switch (provider) {
    case 'anthropic':
      return 'measured';
    case 'codex':
      return CODEX_PRICES[model] != null ? 'measured' : 'unpriced';
    case 'gemini':
      return GEMINI_PRICES[model] != null ? 'measured' : 'unpriced';
    case 'cursor':
      return 'approximate';
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
    case 'openai':
      return 'unpriced';
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
};
