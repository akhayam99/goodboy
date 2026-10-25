import { createOutputStream } from '../../shared/lib/createOutputStream';
import type { LifecycleExitPayload, LifecycleOutputPayload } from './provider-lifecycle';

type LifecycleChunk = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

type LifecycleSnapshot = {
  readonly bytes: Uint8Array;
  readonly offset: number;
  readonly exitCode: number | null;
};

type LifecycleSubscriber = {
  readonly onOutput?: (chunk: LifecycleChunk) => void;
  readonly onExit?: (exitCode: number) => void;
};

type RunIdParams = {
  readonly runId: string;
};

type SubscribeParams = RunIdParams & {
  readonly subscriber: LifecycleSubscriber;
};

const EXITED_RUNS_KEPT = 4;

const lifecycleStream = createOutputStream<'runId', LifecycleOutputPayload, LifecycleExitPayload>({
  outputEvent: 'provider-lifecycle-output',
  exitEvent: 'provider-lifecycle-exit',
  idField: 'runId',
  isStartRequired: true,
  keptExited: EXITED_RUNS_KEPT,
});

const start = ({ runId }: RunIdParams): Promise<void> => lifecycleStream.start({ id: runId });

const subscribe = ({ runId, subscriber }: SubscribeParams): (() => void) =>
  lifecycleStream.subscribe({ id: runId, subscriber });

const snapshotOf = ({ runId }: RunIdParams): LifecycleSnapshot | null =>
  lifecycleStream.snapshotOf({ id: runId });

const release = ({ runId }: RunIdParams): void => {
  lifecycleStream.release({ id: runId });
};

export const lifecycleOutputBuffer = {
  start,
  register: lifecycleStream.register,
  listenAll: lifecycleStream.listenAll,
  subscribe,
  snapshotOf,
  release,
};
