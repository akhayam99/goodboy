import type { AgentId } from '@goodboy/types';
import { agentPlace } from '../../../../../store';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly from: AgentId;
  readonly to: AgentId;
};

export const followAgent = ({ store, from, to }: Params): void => {
  const state = store.getState();
  if (state.currentSessionId !== STORY_SESSION_ID) {
    return;
  }
  if (state.selectedAgentId[STORY_SESSION_ID] !== from) {
    return;
  }
  state.navigate({ to: agentPlace({ sessionId: STORY_SESSION_ID, agentId: to }) });
};
