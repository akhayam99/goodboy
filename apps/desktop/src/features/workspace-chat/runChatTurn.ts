import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { ChatId, ChatMessageId, IsoDateTime, ProviderId, ProviderRunId } from '@goodboy/types';
import type { ChatTurnOutcome } from '../conversation/chatTurnOutcome';
import { streamChatTurn } from '../conversation/streamChatTurn';
import { chatStartError } from './chatStartError';

export type ChatTurnRequest = {
  readonly runId: ProviderRunId;
  readonly chatId: ChatId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort?: string;
  readonly workingDir: string;
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly images?: { readonly messageId: ChatMessageId };
};

export type RunChatTurnParams = {
  readonly request: ChatTurnRequest;
  readonly onText: (delta: string) => void;
  readonly onRead: (path: string) => void;
  readonly onStarted?: () => void;
  readonly now?: () => IsoDateTime;
};

export const runChatTurn = async ({
  request,
  onText,
  onRead,
  onStarted,
  now,
}: RunChatTurnParams): Promise<ChatTurnOutcome> =>
  streamChatTurn({
    runId: request.runId,
    provider: request.provider,
    workingDir: request.workingDir,
    onText,
    onRead,
    ...(onStarted !== undefined && { onStarted }),
    ...(now !== undefined && { now }),
    start: () =>
      invokeCommand<string>('chat_turn', {
        args: {
          runId: request.runId,
          chatId: request.chatId,
          provider: request.provider,
          model: request.model,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          ...(request.effort !== undefined && { effort: request.effort }),
          ...(request.images !== undefined && {
            images: true,
            messageId: request.images.messageId,
          }),
        },
      }).catch((error: unknown) => {
        throw chatStartError({ error });
      }),
  });
