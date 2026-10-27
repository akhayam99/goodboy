import { listen } from '@tauri-apps/api/event';

type OutputPayload<Id extends string> = {
  readonly data: string;
  readonly offset?: number;
} & { readonly [Key in Id]: string };

type ExitPayload<Id extends string> = {
  readonly exitCode: number;
} & { readonly [Key in Id]: string };

type OutputChunk = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

type OutputSnapshot = {
  readonly bytes: Uint8Array;
  readonly offset: number;
  readonly exitCode: number | null;
};

type OutputSubscriber = {
  readonly onOutput?: (chunk: OutputChunk) => void;
  readonly onExit?: (exitCode: number) => void;
};

type ExitNotice = {
  readonly id: string;
  readonly exitCode: number;
};

type OutputStreamParams<Id extends string> = {
  readonly outputEvent: string;
  readonly exitEvent: string;
  readonly idField: Id;
  readonly isStartRequired: boolean;
  readonly keptExited?: number;
};

type IdParams = {
  readonly id: string;
};

type SubscribeParams = IdParams & {
  readonly subscriber: OutputSubscriber;
};

type ListenAllParams<Output, Exit> = {
  readonly onOutput?: (payload: Output) => void;
  readonly onExit?: (payload: Exit) => void;
};

type ExitListenerParams = {
  readonly listener: (notice: ExitNotice) => void;
};

type OutputStream<Output, Exit> = {
  readonly register: () => Promise<void>;
  readonly start: (params: IdParams) => Promise<void>;
  readonly subscribe: (params: SubscribeParams) => () => void;
  readonly listenAll: (params: ListenAllParams<Output, Exit>) => () => void;
  readonly subscribeExits: (params: ExitListenerParams) => () => void;
  readonly snapshotOf: (params: IdParams) => OutputSnapshot | null;
  readonly forget: (params: IdParams) => void;
  readonly release: (params: IdParams) => void;
};

type RunBuffer = {
  chunks: Uint8Array[];
  length: number;
  endOffset: number;
  exitCode: number | null;
};

type DecodeParams = {
  readonly data: string;
};

type PayloadParams<Payload> = {
  readonly payload: Payload;
};

type TrimParams = {
  readonly buffer: RunBuffer;
};

const TAIL_CAP_BYTES = 262_144;

const decodeBase64 = ({ data }: DecodeParams): Uint8Array => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const trim = ({ buffer }: TrimParams): void => {
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

export const createOutputStream = <
  Id extends string,
  Output extends OutputPayload<Id>,
  Exit extends ExitPayload<Id>,
>({
  outputEvent,
  exitEvent,
  idField,
  isStartRequired,
  keptExited,
}: OutputStreamParams<Id>): OutputStream<Output, Exit> => {
  const buffers = new Map<string, RunBuffer>();
  const subscribers = new Map<string, Set<OutputSubscriber>>();
  const exitListeners = new Set<(notice: ExitNotice) => void>();
  const everyOutput = new Set<(payload: Output) => void>();
  const everyExit = new Set<(payload: Exit) => void>();
  let registration: Promise<void> | null = null;

  const evictExited = (): void => {
    if (keptExited === undefined) {
      return;
    }
    const exited = [...buffers.entries()].filter(([, buffer]) => buffer.exitCode !== null);
    for (const [id] of exited.slice(0, Math.max(0, exited.length - keptExited))) {
      if (!subscribers.has(id)) {
        buffers.delete(id);
      }
    }
  };

  const handleOutput = ({ payload }: PayloadParams<Output>): void => {
    for (const listener of [...everyOutput]) {
      listener(payload);
    }
    const id = payload[idField];
    const existing = buffers.get(id);
    if (existing === undefined && isStartRequired) {
      return;
    }
    const buffer = existing ?? {
      chunks: [],
      length: 0,
      endOffset: payload.offset ?? 0,
      exitCode: null,
    };
    buffers.set(id, buffer);
    const bytes = decodeBase64({ data: payload.data });
    const offset = payload.offset ?? buffer.endOffset;
    buffer.chunks.push(bytes);
    buffer.length += bytes.length;
    buffer.endOffset = offset + bytes.length;
    trim({ buffer });
    for (const subscriber of subscribers.get(id) ?? []) {
      subscriber.onOutput?.({ bytes, offset });
    }
  };

  const handleExit = ({ payload }: PayloadParams<Exit>): void => {
    for (const listener of [...everyExit]) {
      listener(payload);
    }
    const id = payload[idField];
    const buffer = buffers.get(id);
    if (buffer === undefined && isStartRequired) {
      return;
    }
    if (buffer !== undefined) {
      buffer.exitCode = payload.exitCode;
    }
    for (const listener of [...exitListeners]) {
      listener({ id, exitCode: payload.exitCode });
    }
    for (const subscriber of subscribers.get(id) ?? []) {
      subscriber.onExit?.(payload.exitCode);
    }
    evictExited();
  };

  const register = (): Promise<void> => {
    if (registration !== null) {
      return registration;
    }
    const pending = Promise.allSettled([
      listen<Output>(outputEvent, (event) => handleOutput({ payload: event.payload })),
      listen<Exit>(exitEvent, (event) => handleExit({ payload: event.payload })),
    ]).then((results) => {
      const failed = results.find((result) => result.status === 'rejected');
      if (failed === undefined) {
        return;
      }
      for (const result of results) {
        if (result.status === 'fulfilled') {
          result.value();
        }
      }
      throw failed.reason;
    });
    registration = pending;
    pending.catch(() => {
      registration = null;
    });
    return pending;
  };

  return {
    register,
    start: async ({ id }) => {
      buffers.set(id, { chunks: [], length: 0, endOffset: 0, exitCode: null });
      await register();
    },
    subscribe: ({ id, subscriber }) => {
      const group = subscribers.get(id) ?? new Set<OutputSubscriber>();
      group.add(subscriber);
      subscribers.set(id, group);
      return () => {
        group.delete(subscriber);
        if (group.size === 0 && subscribers.get(id) === group) {
          subscribers.delete(id);
        }
      };
    },
    listenAll: ({ onOutput, onExit }) => {
      if (onOutput !== undefined) {
        everyOutput.add(onOutput);
      }
      if (onExit !== undefined) {
        everyExit.add(onExit);
      }
      return () => {
        if (onOutput !== undefined) {
          everyOutput.delete(onOutput);
        }
        if (onExit !== undefined) {
          everyExit.delete(onExit);
        }
      };
    },
    subscribeExits: ({ listener }) => {
      exitListeners.add(listener);
      return () => {
        exitListeners.delete(listener);
      };
    },
    snapshotOf: ({ id }) => {
      const buffer = buffers.get(id);
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
    },
    forget: ({ id }) => {
      buffers.delete(id);
    },
    release: ({ id }) => {
      const buffer = buffers.get(id);
      if (buffer === undefined || buffer.exitCode === null) {
        return;
      }
      buffers.delete(id);
    },
  };
};
