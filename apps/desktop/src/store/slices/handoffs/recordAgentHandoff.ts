import { insertAgentHandoff } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { landingLiveKey } from '../../../features/chat/reveal/landingLiveKey';
import { liveTextRegistry } from '../../../features/chat/reveal/liveTextRegistry';
import type { RecordAgentHandoffParams, SetFn } from './types';

export const recordAgentHandoff =
  (set: SetFn) =>
  async ({ handoff }: RecordAgentHandoffParams): Promise<void> => {
    liveTextRegistry.mark({ runId: landingLiveKey({ scope: 'handoff', id: handoff.agentId }) });
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
