import { listen } from '@tauri-apps/api/event';
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

type BufferParams = {
  readonly buffer: RunBuffer;
};

type SubscribeParams = RunIdParams & {
  readonly subscriber: LifecycleSubscriber;
};

type RunBuffer = {
  chunks: Uint8Array[];
  length: number;
  endOffset: number;
  exitCode: number | null;
};

const TAIL_CAP_BYTES = 262_144;
const EXITED_RUNS_KEPT = 4;

const buffers = new Map<string, RunBuffer>();
const subscribers = new Map<string, Set<LifecycleSubscriber>>();
let registration: Promise<void> | null = null;

type DecodeParams = {
  readonly data: string;
};

const decodeBase64 = ({ data }: DecodeParams): Uint8Array => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const bufferOf = ({ runId }: RunIdParams): RunBuffer => {
  const existing = buffers.get(runId);
  if (existing !== undefined) {
    return existing;
  }
  const created: RunBuffer = { chunks: [], length: 0, endOffset: 0, exitCode: null };
  buffers.set(runId, created);
  return created;
};

const trim = ({ buffer }: BufferParams): void => {
  while (buffer.length > TAIL_CAP_BYTES) {
    const first = buffer.chunks[0];
    if (first === undefined) {
      return;
    }
    const excess = buffer.length - TAIL_CAP_BYTES;
    if (excess >= first.length) {
      buffer.chunks.shift();
      buffer.length -= first.length;
      continue;
    }
    buffer.chunks[0] = first.subarray(excess);
    buffer.length -= excess;
  }
};

const evictExited = (): void => {
  const exited = [...buffers.entries()].filter(([, buffer]) => buffer.exitCode !== null);
  for (const [runId] of exited.slice(0, Math.max(0, exited.length - EXITED_RUNS_KEPT))) {
    if (!subscribers.has(runId)) {
      buffers.delete(runId);
    }
  }
};

const handleOutput = (payload: LifecycleOutputPayload): void => {
  const buffer = buffers.get(payload.runId);
  if (buffer === undefined) {
    return;
  }
  const bytes = decodeBase64({ data: payload.data });
  const offset = buffer.endOffset;
  buffer.chunks.push(bytes);
  buffer.length += bytes.length;
  buffer.endOffset += bytes.length;
  trim({ buffer });
  for (const subscriber of subscribers.get(payload.runId) ?? []) {
    subscriber.onOutput?.({ bytes, offset });
  }
};

const handleExit = (payload: LifecycleExitPayload): void => {
  const buffer = buffers.get(payload.runId);
  if (buffer === undefined) {
    return;
  }
  buffer.exitCode = payload.exitCode;
  for (const subscriber of subscribers.get(payload.runId) ?? []) {
    subscriber.onExit?.(payload.exitCode);
  }
  evictExited();
};

const register = (): Promise<void> => {
  if (registration !== null) {
    return registration;
  }
  const pending = Promise.all([
    listen<LifecycleOutputPayload>('provider-lifecycle-output', (e) => handleOutput(e.payload)),
    listen<LifecycleExitPayload>('provider-lifecycle-exit', (e) => handleExit(e.payload)),
  ]).then(() => undefined);
  registration = pending;
  pending.catch(() => {
    registration = null;
  });
  return pending;
};

const start = async ({ runId }: RunIdParams): Promise<void> => {
  buffers.delete(runId);
  bufferOf({ runId });
  await register();
};

const subscribe = ({ runId, subscriber }: SubscribeParams): (() => void) => {
  const group = subscribers.get(runId) ?? new Set<LifecycleSubscriber>();
  group.add(subscriber);
  subscribers.set(runId, group);
  return () => {
    group.delete(subscriber);
    if (group.size === 0 && subscribers.get(runId) === group) {
      subscribers.delete(runId);
    }
  };
};

const snapshotOf = ({ runId }: RunIdParams): LifecycleSnapshot | null => {
  const buffer = buffers.get(runId);
  if (buffer === undefined) {
    return null;
  }
  const bytes = new Uint8Array(buffer.length);
  let cursor = 0;
  for (const chunk of buffer.chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.length;
  }
  return { bytes, offset: buffer.endOffset - buffer.length, exitCode: buffer.exitCode };
};

const release = ({ runId }: RunIdParams): void => {
  const buffer = buffers.get(runId);
  if (buffer === undefined || buffer.exitCode === null) {
    return;
  }
  buffers.delete(runId);
};

export const lifecycleOutputBuffer = { start, register, subscribe, snapshotOf, release };
