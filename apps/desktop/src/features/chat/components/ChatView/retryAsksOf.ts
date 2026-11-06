import type { ProviderRunId, TurnEvent } from '@goodboy/types';
import { askBatchOf } from '../../../permissions/askBatchOf';
import type { ResolvedAsks } from '../../../../store/slices/turn/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly runId: ProviderRunId;
};

export const retryAsksOf = ({ events, runId }: Params): ResolvedAsks => {
  const sent = events.findIndex((event) => event.kind === 'user_text' && event.runId === runId);
  const carried = askBatchOf({ events: events.slice(0, Math.max(sent, 0)) }).answered;
  return { denied: [], held: [...carried, ...askBatchOf({ events }).answered] };
};
