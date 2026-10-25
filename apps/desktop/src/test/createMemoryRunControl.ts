import type { ProviderRunId } from '@goodboy/types';
import type { ChatTurnOutcome } from '../features/conversation/chatTurnOutcome';

type RunParams = {
  readonly request: { readonly runId: ProviderRunId };
};

type CancelParams = {
  readonly runId: ProviderRunId;
};

type Cancellable<Params> = Params & {
  readonly isCancelled: () => boolean;
};

type StartParams<Params> = {
  readonly params: Params;
  readonly respond: (params: Cancellable<Params>) => Promise<ChatTurnOutcome>;
};

export const createMemoryRunControl = () => {
  const cancelled = new Set<ProviderRunId>();
  return {
    start: async <Params extends RunParams>({
      params,
      respond,
    }: StartParams<Params>): Promise<ChatTurnOutcome> => {
      const outcome = await respond({
        ...params,
        isCancelled: () => cancelled.has(params.request.runId),
      });
      cancelled.delete(params.request.runId);
      return outcome;
    },
    cancel: async ({ runId }: CancelParams): Promise<void> => {
      cancelled.add(runId);
    },
  };
};
