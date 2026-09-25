import { insertAgentHandoff } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { RecordAgentHandoffParams, SetFn } from './types';

export const recordAgentHandoff =
  (set: SetFn) =>
  async ({ handoff }: RecordAgentHandoffParams): Promise<void> => {
    set((state) =>
      state.agentHandoffs[handoff.agentId] != null
        ? state
        : { agentHandoffs: { ...state.agentHandoffs, [handoff.agentId]: handoff } },
    );
    try {
      await insertAgentHandoff({ db: tauriDatabase, handoff });
    } catch (error) {
      console.error('agent handoff write failed', error);
    }
  };
