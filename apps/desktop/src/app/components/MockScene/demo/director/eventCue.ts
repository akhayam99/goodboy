import type { AgentId, IsoDateTime, TurnEvent } from '@goodboy/types';
import type { CueParams, DemoCue } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';

type EventsParams = {
  readonly at: IsoDateTime;
};

type Params = {
  readonly atMs: number;
  readonly agentId: AgentId;
  readonly events: (params: EventsParams) => ReadonlyArray<TurnEvent>;
};

export const eventCue = ({ atMs, agentId, events }: Params): DemoCue => ({
  atMs,
  apply: ({ store, at }: CueParams): void =>
    appendTurnEvents({ store, agentId, events: events({ at }) }),
});
