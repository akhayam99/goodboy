import { createOutputStream } from '../../shared/lib/createOutputStream';
import type { TerminalExitPayload, TerminalOutputPayload } from './terminal';

type TerminalBusChunk = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

type TerminalBusTail = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

type TerminalBusSubscriber = {
  readonly onOutput?: (chunk: TerminalBusChunk) => void;
  readonly onExit?: (exitCode: number) => void;
};

type TerminalIdParams = {
  readonly terminalId: string;
};

type SubscribeParams = TerminalIdParams & {
  readonly subscriber: TerminalBusSubscriber;
};

type ExitParams = {
  readonly terminalId: string;
  readonly exitCode: number;
};

type ExitListener = (params: ExitParams) => void;

type SubscribeExitsParams = {
  readonly listener: ExitListener;
};

const stream = createOutputStream<'sessionId', TerminalOutputPayload, TerminalExitPayload>({
  outputEvent: 'terminal-output',
  exitEvent: 'terminal-exit',
  idField: 'sessionId',
  isStartRequired: false,
});

const subscribe = ({ terminalId, subscriber }: SubscribeParams): (() => void) =>
  stream.subscribe({ id: terminalId, subscriber });

const subscribeExits = ({ listener }: SubscribeExitsParams): (() => void) =>
  stream.subscribeExits({
    listener: ({ id, exitCode }) => listener({ terminalId: id, exitCode }),
  });

const tailOf = ({ terminalId }: TerminalIdParams): TerminalBusTail | null => {
  const snapshot = stream.snapshotOf({ id: terminalId });
  return snapshot === null ? null : { bytes: snapshot.bytes, offset: snapshot.offset };
};

const forget = ({ terminalId }: TerminalIdParams): void => {
  stream.forget({ id: terminalId });
};

export const terminalOutputBus = {
  register: stream.register,
  subscribe,
  subscribeExits,
  tailOf,
  forget,
};
