import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { encodeAuthRequiredMessage } from '../../../features/chat/turn';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';

type Params = {
  message: string;
  providerId: ProviderId;
  identity: string | null;
};

export const resolveErrorTurnMessage = ({ message, providerId, identity }: Params): string => {
  const classification = classifyProviderError({ message });

  switch (classification.kind) {
    case 'authentication':
      return encodeAuthRequiredMessage({ providerId, identity });
    case 'model_not_available':
      return classification.action === 'enable_max_mode'
        ? `The model "${classification.model}" requires Max Mode. Enable Max Mode or choose another model.`
        : `The model "${classification.model}" is not available with this Codex account. Choose a model supported by your account.`;
    case 'cli_too_old':
      return `This model needs ${PROVIDER_LABEL[providerId]} CLI ${classification.requiredVersion} or newer, and ${classification.installedVersion} is installed. Update the CLI or choose another model.`;
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
