import type { AgentId } from '@goodboy/types';
import type { Place } from './types';

type Params = {
  readonly from: Place | null;
  readonly to: Place;
};

export const leadRowOf = ({ from, to }: Params): AgentId | null => {
  if (from?.at !== 'session' || to.at !== 'session' || from.sessionId !== to.sessionId) {
    return null;
  }
  const isOverview = to.view.lens === null && to.view.agentId === null && to.view.target === null;
  return isOverview ? from.view.agentId : null;
};
