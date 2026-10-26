import type { MessageAttachment, ProviderId, ProviderRunId, TurnEvent } from '@goodboy/types';

export type RetrySource = {
  readonly content: string;
  readonly attachments: ReadonlyArray<MessageAttachment>;
  readonly provider?: ProviderId;
  readonly model?: string;
};

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly runId: ProviderRunId;
};

export const findRetrySource = ({ events, runId }: Params): RetrySource | null => {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.kind !== 'user_text') {
      continue;
    }
    if (event.runId !== runId) {
      continue;
    }
    return {
      content: event.text,
      attachments: event.attachments ?? [],
      provider: event.provider,
      model: event.model,
    };
  }
  return null;
};
