import type { ProviderRunId, TurnEvent } from '@goodboy/types';
import { askBatchOf, type AnsweredAsk } from '../../../permissions/askBatchOf';
import type { ResolvedAsks } from '../../../../store/slices/turn/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly runId: ProviderRunId;
};

type CarriedParams = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly sent: number;
};

const previousSendOf = ({ events, sent }: CarriedParams): number => {
  for (let index = sent - 1; index >= 0; index -= 1) {
    if (events[index]?.kind === 'user_text') {
      return index;
    }
  }
  return -1;
};

type SameParams = CarriedParams & {
  readonly previous: number;
};

const isSameMessage = ({ events, sent, previous }: SameParams): boolean => {
  const message = events[sent];
  const earlier = events[previous];
  return (
    message?.kind === 'user_text' && earlier?.kind === 'user_text' && message.text === earlier.text
  );
};

const carriedAsksOf = ({ events, sent }: CarriedParams): ReadonlyArray<AnsweredAsk> => {
  if (sent < 0) {
    return [];
  }
  const own = askBatchOf({ events: events.slice(0, sent) }).answered;
  const previous = previousSendOf({ events, sent });
  if (previous < 0 || !isSameMessage({ events, sent, previous })) {
    return own;
  }
  return [...carriedAsksOf({ events, sent: previous }), ...own];
};

export const retryAsksOf = ({ events, runId }: Params): ResolvedAsks => {
  const sent = events.findIndex((event) => event.kind === 'user_text' && event.runId === runId);
  return {
    denied: [],
    held: [...carriedAsksOf({ events, sent }), ...askBatchOf({ events }).answered],
  };
};
