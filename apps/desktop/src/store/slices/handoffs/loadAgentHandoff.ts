import { getAgentHandoff } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, LoadAgentHandoffParams, SetFn } from './types';

export const loadAgentHandoff =
  (set: SetFn, get: GetFn) =>
  async ({ agentId }: LoadAgentHandoffParams): Promise<void> => {
    if (get().agentHandoffs[agentId] !== undefined) {
      return;
    }
    try {
      const handoff = await getAgentHandoff({ db: tauriDatabase, agentId });
      set((state) => ({
        agentHandoffs:
          state.agentHandoffs[agentId] === undefined || handoff !== null
            ? { ...state.agentHandoffs, [agentId]: handoff }
            : state.agentHandoffs,
      }));
    } catch (error) {
      console.error('agent handoff load failed', error);
    }
  };
