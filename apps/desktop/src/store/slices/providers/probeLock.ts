import type { ProviderId } from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import { createKeyedQueue, type KeyedQueue } from '../../../shared/utils/keyedQueue';
import type { GetFn } from './types';

type Kind = 'status' | 'usage' | 'limits' | 'test';

type Queue = {
  readonly serial: KeyedQueue;
  readonly kinds: Map<Kind, Promise<void>>;
};

const queues = new WeakMap<GetFn, Map<ProviderId, Queue>>();

type Params = {
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly kind: Kind;
  readonly isAutomatic: boolean;
  readonly run: () => Promise<void>;
};

type LiveParams = Pick<Params, 'get' | 'providerId'>;

const isProviderLive = ({ get, providerId }: LiveParams): boolean => {
  const state = get();
  const liveRunIds = new Set<string>();
  for (const turn of Object.values(state.agentTurnState)) {
    if ('runId' in turn && isTurnStateLive({ turnState: turn, includeBlocked: true })) {
      liveRunIds.add(turn.runId);
    }
  }
  return Object.values(state.runRouting).some((runs) =>
    Object.entries(runs).some(
      ([runId, routing]) => liveRunIds.has(runId) && routing.provider === providerId,
    ),
  );
};

export const probeLock = ({ get, providerId, kind, isAutomatic, run }: Params): Promise<void> => {
  if (isAutomatic && isProviderLive({ get, providerId })) {
    return Promise.resolve();
  }
  const providers = queues.get(get) ?? new Map<ProviderId, Queue>();
  queues.set(get, providers);
  const queue = providers.get(providerId) ?? { serial: createKeyedQueue(), kinds: new Map() };
  providers.set(providerId, queue);
  const existing = queue.kinds.get(kind);
  if (existing !== undefined) {
    return existing;
  }
  const work = queue.serial
    .run({
      key: providerId,
      task: async () => {
        while (isProviderLive({ get, providerId })) {
          if (isAutomatic) {
            return;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
        await run();
      },
    })
    .finally(() => {
      queue.kinds.delete(kind);
      if (queue.kinds.size === 0) {
        providers.delete(providerId);
      }
    });
  queue.kinds.set(kind, work);
  return work;
};
