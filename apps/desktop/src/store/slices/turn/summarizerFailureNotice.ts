import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { formatErrorForHumans } from '../../../features/chat/formatErrorForHumans';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';

type Params = {
  readonly providerId: ProviderId;
  readonly message: string;
};

export type SummarizerFailureNotice = {
  readonly body: string;
  readonly coalesceKey: string;
};

export const summarizerFailureNotice = ({
  providerId,
  message,
}: Params): SummarizerFailureNotice => {
  const { kind } = classifyProviderError({ message });
  const human = formatErrorForHumans({ message, providerId });
  const body =
    human.body ??
    `${PROVIDER_LABEL[providerId]} stopped before it could summarize this session. Retry, or pick another summarizer model in Providers.`;
  return { body, coalesceKey: `summarizer-failed:${providerId}:${kind}` };
};
