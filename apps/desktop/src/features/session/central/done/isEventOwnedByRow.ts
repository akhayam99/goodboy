import type { SessionEvent } from '@goodboy/types';
import type { DoneModel } from './doneTypes';

type Params = {
  readonly event: SessionEvent;
  readonly model: DoneModel;
};

export const isEventOwnedByRow = ({ event, model }: Params): boolean => {
  const agentId = event.payload?.agentId;
  return (
    agentId !== undefined &&
    model.entries.some((candidate) => candidate.kind === 'agent' && candidate.agent.id === agentId)
  );
};
