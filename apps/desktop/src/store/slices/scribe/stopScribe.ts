import { stopAgentForDelete } from '../agents/stopAgentForDelete';
import type { GetFn, SetFn, StopScribeInput } from './types';

export const stopScribe = (set: SetFn, get: GetFn) => {
  return async ({ key }: StopScribeInput): Promise<void> => {
    const work = get().scribeWork[key];
    if (work === undefined || work.status !== 'writing') {
      return;
    }
    const agentId = work.agentId;
    set((state) => {
      return {
        scribeWork: Object.fromEntries(
          Object.entries(state.scribeWork).filter(([workKey]) => workKey !== key),
        ),
        scribeAgents: Object.fromEntries(
          Object.entries(state.scribeAgents).filter(([, agentKey]) => agentKey !== key),
        ),
      };
    });
    if (agentId === null) {
      return;
    }
    await stopAgentForDelete({ get, agentId });
  };
};
