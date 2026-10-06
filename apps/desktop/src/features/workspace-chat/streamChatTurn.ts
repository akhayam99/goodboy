import { listen } from '@tauri-apps/api/event';
import { createJsonLineAssembler, type ParseContext } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, ProviderId, ProviderRunId, ProviderUsage } from '@goodboy/types';
import { parseProviderLine } from '../chat/parseProviderLine';
import { chatReadPaths } from './chatReadPath';
import type { ChatTurnOutcome } from './runChatTurn';

const CHAT_EVENT_NAME = 'chat_event';

const NO_ANSWER_MESSAGE = 'The provider ended without an answer.';

const CUT_SHORT_MESSAGE = 'The provider stopped before the answer was finished.';

export type StreamChatTurnParams = {
  readonly runId: ProviderRunId;
  readonly provider: ProviderId;
  readonly workingDir: string;
  readonly start: () => Promise<unknown>;
  readonly onText: (delta: string) => void;
  readonly onRead: (path: string) => void;
  readonly onUsage?: (usage: ProviderUsage) => void;
  readonly onStarted?: () => void;
  readonly now?: () => IsoDateTime;
};

type ChatEnvelope =
  | { readonly runId: string; readonly type: 'line'; readonly line: string }
  | {
      readonly runId: string;
      readonly type: 'end';
      readonly exit_code: number | null;
      readonly stderr: string;
    }
  | { readonly runId: string; readonly type: 'error'; readonly message: string };

type LineParams = {
  readonly line: string;
};

type EndParams = {
  readonly envelope: Extract<ChatEnvelope, { readonly type: 'end' }>;
};

type SettleParams = {
  readonly outcome: ChatTurnOutcome;
};

type EnvelopeParams = {
  readonly envelope: ChatEnvelope;
};

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export const streamChatTurn = async ({
  runId,
  provider,
  workingDir,
  start,
  onText,
  onRead,
  onUsage,
  onStarted,
  now = isoNow,
}: StreamChatTurnParams): Promise<ChatTurnOutcome> => {
  const ctx: ParseContext = { runId, now };
  const assembler = createJsonLineAssembler();
  let hasText = false;
  let failure: string | null = null;
  const unparsed: string[] = [];

  const handleLine = ({ line }: LineParams) => {
    const events = parseProviderLine({ provider, line, ctx });
    if (events.length === 0 && line.trim() !== '' && !line.trim().startsWith('{')) {
      unparsed.push(line.trim());
    }
    for (const event of events) {
      if (event.kind === 'assistant_text' && event.delta !== '') {
        hasText = true;
        onText(event.delta);
        continue;
      }
      if (event.kind === 'error') {
        failure = event.message;
        continue;
      }
      if (event.kind === 'usage') {
        onUsage?.(event.usage);
        continue;
      }
      chatReadPaths({ event, workingDir }).forEach((path) => onRead(path));
    }
  };

  const endOutcome = ({ envelope }: EndParams): ChatTurnOutcome => {
    for (const line of assembler.flush()) {
      handleLine({ line });
    }
    if (failure !== null) {
      return { status: 'failed', error: failure };
    }
    const isCleanExit = envelope.exit_code === 0;
    if (hasText && isCleanExit) {
      return { status: 'done' };
    }
    if (hasText) {
      const stderr = envelope.stderr.trim();
      return { status: 'failed', error: stderr === '' ? CUT_SHORT_MESSAGE : stderr };
    }
    const detail = [...unparsed, envelope.stderr.trim()].filter((part) => part !== '').join('\n');
    return { status: 'failed', error: detail === '' ? NO_ANSWER_MESSAGE : detail };
  };

  return new Promise<ChatTurnOutcome>((resolve) => {
    let isSettled = false;
    let stopListening: (() => void) | null = null;
    const settle = ({ outcome }: SettleParams) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      stopListening?.();
      resolve(outcome);
    };
    const handleEnvelope = ({ envelope }: EnvelopeParams) => {
      switch (envelope.type) {
        case 'line': {
          const assembled = assembler.push({ line: envelope.line });
          if (assembled.kind === 'line') {
            handleLine({ line: assembled.line });
          }
          if (assembled.kind === 'overflow') {
            assembled.lines.forEach((line) => handleLine({ line }));
          }
          return;
        }
        case 'error':
          failure = envelope.message;
          return;
        case 'end':
          settle({ outcome: endOutcome({ envelope }) });
          return;
        default: {
          const exhaustive: never = envelope;
          return exhaustive;
        }
      }
    };
    void listen<ChatEnvelope>(CHAT_EVENT_NAME, (event) => {
      if (event.payload.runId !== runId) {
        return;
      }
      handleEnvelope({ envelope: event.payload });
    })
      .then((unlisten) => {
        if (isSettled) {
          unlisten();
          return;
        }
        stopListening = unlisten;
        return start().then(() => onStarted?.());
      })
      .catch((error: unknown) =>
        settle({ outcome: { status: 'failed', error: formatError(error) } }),
      );
  });
};
