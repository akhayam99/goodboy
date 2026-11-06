import { countUserTextEvents } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { SessionId, UserTurnSentVia } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { storedToAttachmentInput } from '../../../features/attachments/pendingAttachment';
import { isTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import { ReportedError, isReportedError } from '../notifications/reportedError';
import { turnRefusalMessage } from '../turn/refusal/turnRefusalMessage';
import { turnRefusalOf } from '../turn/refusal/turnRefusalOf';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueHold, AgentQueuedTurn, GetFn, QueuedTurnDelivery, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  turn: AgentQueuedTurn;
  sentVia?: UserTurnSentVia;
  isForced?: boolean;
}>;

type FailParams = Readonly<{
  error: unknown;
  title: string;
}>;

const NOT_STARTED = 'The agent did not start. Your message is safe here.';

const COUNT_NOT_SAVED = "The message couldn't be saved, so it was not sent.";

const DELIVERED: QueuedTurnDelivery = { isDelivered: true, failure: null };

export const deliverQueuedTurn = async ({
  set,
  get,
  sessionId,
  turn,
  sentVia,
  isForced = false,
}: Params): Promise<QueuedTurnDelivery> => {
  const { agentId } = turn;
  let removal: Promise<boolean> | undefined;
  const accept = (): Promise<boolean> => {
    removal ??= (async () => {
      const current = readAgentQueue({ get, agentId });
      if (!current.some((item) => item.id === turn.id)) {
        return true;
      }
      writeAgentQueue({ set, agentId, queue: current.filter((item) => item.id !== turn.id) });
      return persistAgentQueue({ get, agentId });
    })();
    return removal;
  };
  let writtenTexts = turn.writtenTexts ?? 0;
  const hold = async ({ reason }: AgentQueueHold): Promise<void> => {
    const rest = readAgentQueue({ get, agentId }).filter((item) => item.id !== turn.id);
    writeAgentQueue({
      set,
      agentId,
      queue: [
        { ...turn, status: 'queued', hold: { reason }, writtenTexts, isTextShown: false },
        ...rest,
      ],
    });
    await persistAgentQueue({ get, agentId });
  };
  const markWriting = async (): Promise<void> => {
    const textsBefore = writtenTexts;
    writtenTexts += 1;
    writeAgentQueue({
      set,
      agentId,
      queue: readAgentQueue({ get, agentId }).map((item) =>
        item.id === turn.id ? { ...item, writtenTexts, isTextShown: true } : item,
      ),
    });
    const isSaved = await persistAgentQueue({ get, agentId });
    if (!isSaved) {
      writtenTexts = textsBefore;
      throw new ReportedError(COUNT_NOT_SAVED);
    }
  };
  const fail = async ({ error, title }: FailParams): Promise<QueuedTurnDelivery> => {
    const message = formatError(error);
    await hold({ reason: message });
    if (isReportedError(error)) {
      return { isDelivered: false, failure: null };
    }
    if (turn.isDirect === true) {
      return { isDelivered: false, failure: message };
    }
    void get().reportError({ title, error, sessionId });
    return { isDelivered: false, failure: null };
  };
  const deliveryId = `queue:${turn.id}`;
  let isAccepted = false;
  try {
    const delivered = await countUserTextEvents({ db: tauriDatabase, agentId, deliveryId });
    if (delivered > writtenTexts) {
      await accept();
      return DELIVERED;
    }
    writtenTexts = delivered;
  } catch (error) {
    return fail({ error, title: "Couldn't check the queued message" });
  }
  try {
    const result = await get().sendTurn({
      sessionId,
      agentId,
      content: turn.content,
      origin: 'operator',
      deliveryId,
      ...(turn.attachments.length > 0 && {
        attachments: turn.attachments.map(storedToAttachmentInput),
      }),
      ...(turn.override !== undefined && { override: turn.override }),
      ...(sentVia !== undefined && { sentVia }),
      ...(isForced && { force: true }),
      onWritingUserText: markWriting,
      onStarted: () => {
        isAccepted = true;
        void accept();
      },
    });
    const refusal = turnRefusalOf({ result });
    if (refusal !== null && !isAccepted) {
      await hold({ reason: turnRefusalMessage({ refusal }) });
      return { isDelivered: false, failure: null };
    }
    if (isAccepted || result.isLaneQueued === true || result.isAlreadySent === true) {
      await accept();
      return DELIVERED;
    }
    await hold({ reason: NOT_STARTED });
    return { isDelivered: false, failure: null };
  } catch (error) {
    if (isTranscriptOwnedTurnError({ error }) || isAccepted) {
      if (!isTranscriptOwnedTurnError({ error })) {
        void get().reportError({ title: "Couldn't send the queued message", error, sessionId });
      }
      await accept();
      return DELIVERED;
    }
    return fail({ error, title: "Couldn't send the queued message" });
  }
};
