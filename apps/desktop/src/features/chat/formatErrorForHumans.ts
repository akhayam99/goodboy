import type { ProviderId } from '@goodboy/types';
import { splitErrorMessage } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import { classifyProviderError } from './classifyProviderError';

type Params = {
  readonly message: string;
  readonly providerId?: ProviderId | null;
};

export type HumanError = {
  readonly body: string | null;
  readonly detail: string | null;
};

const providerName = ({ providerId }: { readonly providerId: ProviderId | null }): string =>
  providerId !== null ? PROVIDER_LABEL[providerId] : 'The provider';

const withDetail = ({ body, message }: { readonly body: string; readonly message: string }) => ({
  body,
  detail: message.trim() === '' ? null : message.trim(),
});

export const formatErrorForHumans = ({ message, providerId = null }: Params): HumanError => {
  const classification = classifyProviderError({ message });
  const name = providerName({ providerId });

  switch (classification.kind) {
    case 'authentication':
      return withDetail({ body: `${name} is not signed in.`, message });
    case 'model_not_available':
      return withDetail({
        body: `The model "${classification.model}" is not available with this account.`,
        message,
      });
    case 'cli_too_old':
      return withDetail({
        body: `This model needs ${name} CLI ${classification.requiredVersion} or newer. You have ${classification.installedVersion}.`,
        message,
      });
    case 'rate_limit':
      return withDetail({
        body: `${name} is limiting requests right now. Wait a moment, then retry.`,
        message,
      });
    case 'usage_limit':
      return withDetail({ body: `${name} reached the usage limit for this account.`, message });
    case 'unreachable':
      return withDetail({
        body: `${name} couldn't be reached. This usually clears in a minute.`,
        message,
      });
    case 'other': {
      const { summary, detail } = splitErrorMessage({ message });
      return { body: summary, detail };
    }
    default: {
      const exhaustive: never = classification;
      return exhaustive;
    }
  }
};
