import {
  listenTerminalExit,
  listenTerminalOutput,
  type TerminalExitPayload,
  type TerminalOutputPayload,
} from './terminal';

export type TerminalBusChunk = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

export type TerminalBusTail = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

export type TerminalBusSubscriber = {
  readonly onOutput?: (chunk: TerminalBusChunk) => void;
  readonly onExit?: (exitCode: number) => void;
};

type TerminalIdParams = {
  readonly terminalId: string;
};

type SubscribeParams = TerminalIdParams & {
  readonly subscriber: TerminalBusSubscriber;
};

type TailState = {
  chunks: Uint8Array[];
  length: number;
  endOffset: number;
};

const TAIL_CAP_BYTES = 262_144;

const tails = new Map<string, TailState>();
const subscribers = new Map<string, Set<TerminalBusSubscriber>>();
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

const appendTail = ({ terminalId, bytes, offset }: TerminalIdParams & TerminalBusChunk): void => {
  const tail = tails.get(terminalId) ?? { chunks: [], length: 0, endOffset: offset };
  tails.set(terminalId, tail);
  tail.chunks.push(bytes);
  tail.length += bytes.length;
  tail.endOffset = offset + bytes.length;
  while (tail.length > TAIL_CAP_BYTES) {
    const first = tail.chunks[0];
    if (first === undefined) {
      return;
    }
    const excess = tail.length - TAIL_CAP_BYTES;
    if (excess >= first.length) {
      tail.chunks.shift();
      tail.length -= first.length;
      continue;
    }
    tail.chunks[0] = first.subarray(excess);
    tail.length -= excess;
  }
};

const handleOutput = (payload: TerminalOutputPayload): void => {
  const bytes = decodeBase64({ data: payload.data });
  appendTail({ terminalId: payload.sessionId, bytes, offset: payload.offset });
  for (const subscriber of subscribers.get(payload.sessionId) ?? []) {
    subscriber.onOutput?.({ bytes, offset: payload.offset });
  }
};

const handleExit = (payload: TerminalExitPayload): void => {
  for (const subscriber of subscribers.get(payload.sessionId) ?? []) {
    subscriber.onExit?.(payload.exitCode);
  }
};

const register = (): Promise<void> => {
  if (registration !== null) {
    return registration;
  }
  const pending = Promise.all([
    listenTerminalOutput(handleOutput),
    listenTerminalExit(handleExit),
  ]).then(() => undefined);
  registration = pending;
  pending.catch(() => {
    registration = null;
  });
  return pending;
};

const subscribe = ({ terminalId, subscriber }: SubscribeParams): (() => void) => {
  const group = subscribers.get(terminalId) ?? new Set<TerminalBusSubscriber>();
  group.add(subscriber);
  subscribers.set(terminalId, group);
  return () => {
    group.delete(subscriber);
    if (group.size === 0 && subscribers.get(terminalId) === group) {
      subscribers.delete(terminalId);
    }
  };
};

const tailOf = ({ terminalId }: TerminalIdParams): TerminalBusTail | null => {
  const tail = tails.get(terminalId);
  if (tail === undefined) {
    return null;
  }
  const bytes = new Uint8Array(tail.length);
  let cursor = 0;
  for (const chunk of tail.chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.length;
  }
  return { bytes, offset: tail.endOffset - tail.length };
};

const forget = ({ terminalId }: TerminalIdParams): void => {
  tails.delete(terminalId);
};

export const terminalOutputBus = { register, subscribe, tailOf, forget };
