import type { Agent } from '@goodboy/types';

export const agentHasUnread = (agent: Agent, isCurrentlyViewed: boolean): boolean => {
  if (agent.doneAt != null) {
    return false;
  }
  if (isCurrentlyViewed) {
    return false;
  }
  if (agent.status === 'skipped') {
    return false;
  }
  if (agent.lastFinishedAt == null) {
    return false;
  }
  if (agent.lastViewedAt == null) {
    return true;
  }
  return agent.lastFinishedAt > agent.lastViewedAt;
};
