import type {
  ChatId,
  IsoDateTime,
  ModelKey,
  ProviderId,
  ProviderRunId,
  ProviderUsage,
  SessionId,
} from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { resolveChatModel } from '../../workspace-chat/resolveChatModel';
import type { ChatTurnOutcome } from '../../workspace-chat/runChatTurn';
import { streamChatTurn } from '../../workspace-chat/streamChatTurn';
import type { AskDossierFile } from './askHandles';

type AskTurnRequest = {
  readonly runId: ProviderRunId;
  readonly threadId: ChatId;
  readonly sessionId: SessionId;
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly effort: string | null;
  readonly workingDir: string;
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly dossier: ReadonlyArray<AskDossierFile>;
};

export type RunAskTurnParams = {
  readonly request: AskTurnRequest;
  readonly onText: (delta: string) => void;
  readonly onRead: (path: string) => void;
  readonly onUsage: (usage: ProviderUsage) => void;
  readonly onStarted?: () => void;
  readonly now?: () => IsoDateTime;
};

export const runAskTurn = async ({
  request,
  onText,
  onRead,
  onUsage,
  onStarted,
  now,
}: RunAskTurnParams): Promise<ChatTurnOutcome> => {
  const resolved = resolveChatModel({ provider: request.provider, modelKey: request.model });
  const effort = request.effort ?? resolved.effort ?? null;
  return streamChatTurn({
    runId: request.runId,
    provider: request.provider,
    workingDir: request.workingDir,
    onText,
    onRead,
    onUsage,
    ...(onStarted !== undefined && { onStarted }),
    ...(now !== undefined && { now }),
    start: () =>
      invokeCommand<string>('ask_turn', {
        args: {
          runId: request.runId,
          threadId: request.threadId,
          sessionId: request.sessionId,
          provider: request.provider,
          model: resolved.model,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          ...(effort !== null && { effort }),
          dossier: request.dossier,
        },
      }),
  });
};
