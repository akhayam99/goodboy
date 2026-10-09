import type { AgentId } from '@goodboy/types';
import type { AgentPane } from '../navigation/types';
import type { SetFn } from './types';

type Params = {
  readonly agentId: AgentId;
  readonly pane: AgentPane;
};

export const setAgentTab = (set: SetFn) => {
  return ({ agentId, pane }: Params): void => {
    set((state) => {
      if (state.agentTab[agentId] === pane) {
        return state;
      }
      return { agentTab: { ...state.agentTab, [agentId]: pane } };
    });
  };
};
