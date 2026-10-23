import type { AgentId } from '@goodboy/types';

type Run = {
  readonly agentId: AgentId | undefined;
  readonly cancel: () => void;
};

type TrackParams = {
  readonly agentId?: AgentId | undefined;
  readonly cancel: () => void;
};

type AgentParams = {
  readonly agentId: AgentId;
};

type GenerationParams = {
  readonly generation: number;
};

export type DemoRunScope = {
  readonly generation: () => number;
  readonly isCurrent: (params: GenerationParams) => boolean;
  readonly track: (params: TrackParams) => () => void;
  readonly stop: (params: AgentParams) => void;
  readonly cancelAll: () => void;
  readonly size: () => number;
};

export const createDemoRunScope = (): DemoRunScope => {
  const running = new Set<Run>();
  let generation = 0;
  return {
    generation: () => generation,
    isCurrent: ({ generation: started }) => started === generation,
    track: ({ agentId, cancel }) => {
      const run: Run = { agentId, cancel };
      running.add(run);
      return () => {
        running.delete(run);
      };
    },
    stop: ({ agentId }) => {
      for (const run of [...running]) {
        if (run.agentId !== agentId) {
          continue;
        }
        running.delete(run);
        run.cancel();
      }
    },
    cancelAll: () => {
      generation += 1;
      const runs = [...running];
      running.clear();
      for (const run of runs) {
        run.cancel();
      }
    },
    size: () => running.size,
  };
};
