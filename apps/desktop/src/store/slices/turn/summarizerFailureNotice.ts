import type { ProviderId, SessionId } from '@goodboy/types';
import { formatErrorForHumans } from '../../../features/chat/formatErrorForHumans';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';

type Params = {
  readonly providerId: ProviderId;
  readonly message: string;
};

type KeyParams = {
  readonly sessionId: SessionId;
};

export const summarizerNoticeKey = ({ sessionId }: KeyParams): string =>
  `summarizer-failed:${sessionId}`;

export const summarizerFailureNotice = ({ providerId, message }: Params): { body: string } => {
  const human = formatErrorForHumans({ message, providerId });
  return {
    body:
      human.body ??
      `${PROVIDER_LABEL[providerId]} stopped before it could summarize this session. Retry, or pick another summarizer model in Providers.`,
  };
};
