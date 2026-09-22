import type { ProviderId, SpendReservation } from '@goodboy/types';
import { computeProviderCostUsd } from '../providers/provider-cost';

type Params = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly prompt: string;
  readonly allowOverBudget?: boolean;
};

const UNKNOWN_PRICE_COMMITMENT_USD = 0.25;
const MINIMUM_PRICED_COMMITMENT_USD = 0.001;
const MINIMUM_OUTPUT_TOKENS = 1_024;

export const estimateSpendReservation = ({
  providerId,
  model,
  prompt,
  allowOverBudget,
}: Params): SpendReservation => {
  const inputTokens = Math.max(1, Math.ceil(prompt.length / 4));
  const outputTokens = Math.max(MINIMUM_OUTPUT_TOKENS, Math.ceil(inputTokens / 2));
  const estimate = computeProviderCostUsd({
    providerId,
    model,
    usage: {
      inputTokens,
      outputTokens,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
      estimatedCostUsd: 0,
    },
  });
  return {
    estimatedSpendUsd:
      estimate > 0
        ? Math.max(estimate, MINIMUM_PRICED_COMMITMENT_USD)
        : UNKNOWN_PRICE_COMMITMENT_USD,
    allowOverBudget: allowOverBudget === true,
  };
};
