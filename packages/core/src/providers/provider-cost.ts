import type { ProviderId, ProviderUsage } from '@goodboy/types';
import { computeCostUsd } from './claude/cost';
import { computeCodexCostUsd, type CodexModelPriceOverride } from './codex/cost';
import { computeCursorCostUsd } from './cursor/cost';
import { computeGeminiCostUsd } from './gemini/cost';
import { computeOpenCodeCostUsd } from './opencode/cost';

type Params = {
  readonly providerId: ProviderId;
  readonly usage: ProviderUsage;
  readonly model: string;
  readonly priceOverride?: CodexModelPriceOverride | null;
};

export const computeProviderCostUsd = ({
  providerId,
  usage,
  model,
  priceOverride,
}: Params): number => {
  switch (providerId) {
    case 'anthropic':
      return computeCostUsd({ usage, model });
    case 'cursor':
      return computeCursorCostUsd({ usage, model });
    case 'codex':
      return computeCodexCostUsd({ usage, model, override: priceOverride });
    case 'gemini':
      return computeGeminiCostUsd({ usage, model, override: priceOverride });
    case 'opencode':
    case 'openrouter':
      return computeOpenCodeCostUsd({ usage, model });
    default: {
      const exhaustive: never = providerId;
      return exhaustive;
    }
  }
};
