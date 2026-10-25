import { outputHandoffsInitialState } from './state';
import type {
  ConsumeOutputHandoffsParams,
  OutputHandoffsSlice,
  QueueOutputHandoffParams,
} from './types';
import type { SliceDeps } from '../../slice-types';

export const createOutputHandoffsSlice = ({ set }: SliceDeps): OutputHandoffsSlice => ({
  ...outputHandoffsInitialState,
  queueOutputHandoff: ({ agentId, handoff }: QueueOutputHandoffParams) =>
    set((state) => ({
      outputHandoffs: {
        ...state.outputHandoffs,
        [agentId]: [...(state.outputHandoffs[agentId] ?? []), handoff],
      },
    })),
  consumeOutputHandoffs: ({ agentId, ids }: ConsumeOutputHandoffsParams) =>
    set((state) => {
      const queued = state.outputHandoffs[agentId] ?? [];
      const rest = queued.filter((handoff) => !ids.includes(handoff.id));
      if (rest.length === queued.length) {
        return state;
      }
      return { outputHandoffs: { ...state.outputHandoffs, [agentId]: rest } };
    }),
});
