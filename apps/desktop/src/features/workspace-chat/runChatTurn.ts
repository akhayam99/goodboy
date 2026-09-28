import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createJsonLineAssembler, type ParseContext } from '@goodboy/core';
import type { ChatId, IsoDateTime, ProviderId, ProviderRunId } from '@goodboy/types';
import { parseProviderLine } from '../chat/parseProviderLine';
import { chatReadPaths } from './chatReadPath';

export const CHAT_EVENT_NAME = 'chat_event';

const NO_ANSWER_MESSAGE = 'The provider ended without an answer.';

export type ChatTurnRequest = {
  readonly runId: ProviderRunId;
  readonly chatId: ChatId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort?: string;
  readonly workingDir: string;
  readonly prompt: string;
  readonly systemPrompt: string;
};

export type ChatTurnOutcome =
  { readonly status: 'done' } | { readonly status: 'failed'; readonly error: string };

export type RunChatTurnParams = {
  readonly request: ChatTurnRequest;
  readonly onText: (delta: string) => void;
  readonly onRead: (path: string) => void;
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

type ErrorParams = {
  readonly error: unknown;
};

const messageOf = ({ error }: ErrorParams): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const message: unknown = Reflect.get(error, 'message');
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
};

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

export const runChatTurn = async ({
  request,
  onText,
  onRead,
  now = isoNow,
}: RunChatTurnParams): Promise<ChatTurnOutcome> => {
  const ctx: ParseContext = { runId: request.runId, now };
  const assembler = createJsonLineAssembler();
  let hasText = false;
  let failure: string | null = null;
  const unparsed: string[] = [];

  const handleLine = ({ line }: LineParams) => {
    const events = parseProviderLine({ provider: request.provider, line, ctx });
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
      chatReadPaths({ event, workingDir: request.workingDir }).forEach((path) => onRead(path));
    }
  };

  const endOutcome = ({ envelope }: EndParams): ChatTurnOutcome => {
    for (const line of assembler.flush()) {
      handleLine({ line });
    }
    if (failure !== null && !hasText) {
      return { status: 'failed', error: failure };
    }
    if (hasText) {
      return { status: 'done' };
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
      if (event.payload.runId !== request.runId) {
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
        return invoke<string>('chat_turn', {
          args: {
            runId: request.runId,
            chatId: request.chatId,
            provider: request.provider,
            model: request.model,
            prompt: request.prompt,
            systemPrompt: request.systemPrompt,
            ...(request.effort !== undefined && { effort: request.effort }),
          },
        });
      })
      .catch((error: unknown) =>
        settle({ outcome: { status: 'failed', error: messageOf({ error }) } }),
      );
  });
};
