import { stopAgentForDelete } from '../agents/stopAgentForDelete';
import { patchScribeWork } from './requestScribe';
import type { GetFn, SetFn, StopScribeInput } from './types';

const SCRIBE_STOP_FAILED = "Couldn't stop the writing. Stop it again.";

export const stopScribe = (set: SetFn, get: GetFn) => {
  return async ({ key }: StopScribeInput): Promise<void> => {
    const work = get().scribeWork[key];
    if (work === undefined || work.status === 'creating' || work.status === 'created') {
      return;
    }
    const agentId = work.status === 'writing' ? work.agentId : null;
    if (agentId !== null) {
      const isStopped = await stopAgentForDelete({ get, agentId }).catch(() => false);
      if (!isStopped) {
        patchScribeWork({ set, key, patch: { error: SCRIBE_STOP_FAILED } });
        return;
      }
    }
    set((state) => ({
      scribeWork: Object.fromEntries(
        Object.entries(state.scribeWork).filter(([workKey]) => workKey !== key),
      ),
      scribeAgents: Object.fromEntries(
        Object.entries(state.scribeAgents).filter(([, agentKey]) => agentKey !== key),
      ),
    }));
  };
};
