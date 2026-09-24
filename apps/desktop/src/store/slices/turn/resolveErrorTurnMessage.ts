import { catalogModelForId } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { encodeAuthRequiredMessage, encodeCliTooOldMessage } from '../../../features/chat/turn';

type Params = {
  message: string;
  providerId: ProviderId;
  identity: string | null;
  model?: string | null;
  fallbackModel?: string | null;
};

type ModelKeyParams = {
  readonly providerId: ProviderId;
  readonly model: string | null;
};

const modelKeyFor = ({ providerId, model }: ModelKeyParams): string | null =>
  model === null
    ? null
    : (catalogModelForId({ provider: providerId, modelId: model })?.key ?? null);

export const resolveErrorTurnMessage = ({
  message,
  providerId,
  identity,
  model = null,
  fallbackModel = null,
}: Params): string => {
  const classification = classifyProviderError({ message });

  switch (classification.kind) {
    case 'authentication':
      return encodeAuthRequiredMessage({ providerId, identity });
    case 'model_not_available':
      return classification.action === 'enable_max_mode'
        ? `The model "${classification.model}" requires Max Mode. Enable Max Mode or choose another model.`
        : `The model "${classification.model}" is not available with this Codex account. Choose a model supported by your account.`;
    case 'cli_too_old':
      return encodeCliTooOldMessage({
        providerId,
        modelKey: modelKeyFor({ providerId, model }),
        installedVersion: classification.installedVersion,
        requiredVersion: classification.requiredVersion,
        fallbackModelKey: modelKeyFor({ providerId, model: fallbackModel }),
        detail: message,
      });
    case 'rate_limit':
    case 'usage_limit':
    case 'unreachable':
    case 'other':
      return message;
    default: {
      const exhaustive: never = classification;
      return exhaustive;
    }
  }
};
