import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';

type AgentParams = {
  readonly agentId: AgentId;
};

type RunParams = AgentParams & {
  readonly runId: ProviderRunId;
};

type EnqueueParams = RunParams & {
  readonly start: () => void;
};

type LaterParams = RunParams & {
  readonly delayMs: number;
  readonly run: () => void;
};

type FinishParams = RunParams & {
  readonly onIdle: () => void;
};

type Queued = {
  readonly runId: ProviderRunId;
  readonly start: () => void;
};

export type ReplyRuns = {
  readonly nextRunId: (params: AgentParams) => ProviderRunId;
  readonly enqueue: (params: EnqueueParams) => void;
  readonly isActive: (params: RunParams) => boolean;
  readonly later: (params: LaterParams) => void;
  readonly finish: (params: FinishParams) => void;
  readonly cancelAgent: (params: AgentParams) => void;
  readonly cancel: () => void;
  readonly dispose: () => void;
};

export const createReplyRuns = (): ReplyRuns => {
  const active = new Map<AgentId, ProviderRunId>();
  const queued = new Map<AgentId, ReadonlyArray<Queued>>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let count = 0;
  let isDisposed = false;

  const cancel = (): void => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
    active.clear();
    queued.clear();
  };

  const isActive = ({ agentId, runId }: RunParams): boolean =>
    !isDisposed && active.get(agentId) === runId;

  return {
    nextRunId: ({ agentId }) => {
      count += 1;
      return brandId<ProviderRunId>({ value: `demo-run-${agentId}-${count}` });
    },
    enqueue: ({ agentId, runId, start }) => {
      if (isDisposed) {
        return;
      }
      if (active.has(agentId)) {
        queued.set(agentId, [...(queued.get(agentId) ?? []), { runId, start }]);
        return;
      }
      active.set(agentId, runId);
      start();
    },
    isActive,
    later: ({ agentId, runId, delayMs, run }) => {
      if (!isActive({ agentId, runId })) {
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!isActive({ agentId, runId })) {
          return;
        }
        run();
      }, delayMs);
      timers.add(timer);
    },
    finish: ({ agentId, runId, onIdle }) => {
      if (!isActive({ agentId, runId })) {
        return;
      }
      const [next, ...rest] = queued.get(agentId) ?? [];
      if (next === undefined) {
        active.delete(agentId);
        onIdle();
        return;
      }
      queued.set(agentId, rest);
      active.set(agentId, next.runId);
      next.start();
    },
    cancelAgent: ({ agentId }) => {
      active.delete(agentId);
      queued.delete(agentId);
    },
    cancel,
    dispose: () => {
      isDisposed = true;
      cancel();
    },
  };
};
