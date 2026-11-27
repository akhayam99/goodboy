import type { MessageAttachment } from '@goodboy/types';
import type { AttachmentStripItem } from '../../../attachments/AttachmentStrip';
import { pendingMessageLineOf } from '../../../auto/chat/pendingMessageOf';
import type { QueuedRow } from '../../queuedMessages/queuedRow';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';
import { directRevealAtOf } from './directRevealAtOf';
import { NAMES } from '../../../../shared/utils/names';

type Params = {
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly view: AutoTreeView | null;
  readonly isAgentStopped: boolean;
  readonly nowMs: number;
};

const AGENT_QUEUED_TEXT = NAMES.waitsForThisReply;

const AGENT_SENDING_TEXT = 'Sending now';

const AGENT_HELD_TEXT = 'Not delivered';

const AGENT_STOPPED_TEXT = 'Sends when you Continue';

type AutoImageParams = {
  readonly image: MessageAttachment;
};

const autoImageOf = ({ image }: AutoImageParams): AttachmentStripItem => ({
  id: image.id,
  fileName: image.fileName,
  mimeType: image.mimeType,
  kind: 'image',
  relPath: image.relPath,
  workingDir: image.dir ?? null,
});

type TrayRowParams = {
  readonly turn: AgentQueuedTurn;
  readonly isAgentStopped: boolean;
};

type TrayLine = Pick<QueuedRow, 'status' | 'statusText' | 'reason' | 'action'>;

const trayLineOf = ({ turn, isAgentStopped }: TrayRowParams): TrayLine => {
  if (turn.status === 'sending') {
    return { status: 'sending', statusText: AGENT_SENDING_TEXT, reason: null, action: null };
  }
  if (turn.hold !== undefined) {
    return {
      status: 'notDelivered',
      statusText: AGENT_HELD_TEXT,
      reason: turn.hold.reason,
      action: 'retry',
    };
  }
  if (isAgentStopped) {
    return { status: 'queued', statusText: AGENT_STOPPED_TEXT, reason: null, action: 'sendNow' };
  }
  return { status: 'queued', statusText: AGENT_QUEUED_TEXT, reason: null, action: 'sendNow' };
};

const trayRowOf = ({ turn, isAgentStopped }: TrayRowParams): QueuedRow => ({
  id: turn.id,
  source: 'agent',
  content: turn.content,
  images: turn.attachments
    .filter((attachment) => attachment.mimeType.startsWith('image/'))
    .map((attachment): AttachmentStripItem => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      kind: 'image',
      relPath: attachment.relPath ?? attachment.fileName,
      workingDir: null,
      previewSrc: attachment.dataUrl,
    })),
  imageCount: turn.attachments.length,
  override: turn.override,
  ...trayLineOf({ turn, isAgentStopped }),
});

type ShownParams = {
  readonly turn: AgentQueuedTurn;
  readonly nowMs: number;
};

const isRevealed = ({ turn, nowMs }: ShownParams): boolean => {
  const revealAt = directRevealAtOf({ turn });
  return revealAt === null || nowMs >= revealAt;
};

type TurnParams = {
  readonly turn: AgentQueuedTurn;
};

const isInTranscript = ({ turn }: TurnParams): boolean =>
  turn.status === 'sending' && turn.isTextShown === true;

type AutoRowsParams = {
  readonly view: AutoTreeView;
};

const autoRowsOf = ({ view }: AutoRowsParams): ReadonlyArray<QueuedRow> => {
  const line = pendingMessageLineOf({ view });
  return [...view.pendingMessages]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((message): QueuedRow => ({
      id: message.rowId,
      source: 'auto',
      content: message.noteText ?? message.text,
      images: message.images
        .filter((image) => image.kind === 'image')
        .map((image) => autoImageOf({ image })),
      imageCount: message.images.length,
      override: undefined,
      status: line.tone,
      statusText: line.text,
      reason: line.reason,
      action: line.action,
    }));
};

type HandedOffParams = {
  readonly turn: AgentQueuedTurn;
  readonly autoRows: ReadonlyArray<QueuedRow>;
  readonly view: AutoTreeView | null;
};

const isHandedOff = ({ turn, autoRows, view }: HandedOffParams): boolean =>
  turn.status === 'sending' &&
  view !== null &&
  view.pendingMessages.some(
    (message) =>
      message.text === turn.content &&
      message.createdAt >= Date.parse(turn.createdAt) &&
      autoRows.some((row) => row.id === message.rowId),
  );

export const queuedRowsOf = ({
  queue,
  view,
  isAgentStopped,
  nowMs,
}: Params): ReadonlyArray<QueuedRow> => {
  const autoRows = view === null ? [] : autoRowsOf({ view });
  return [
    ...autoRows,
    ...queue
      .filter(
        (turn) =>
          !isHandedOff({ turn, autoRows, view }) &&
          !isInTranscript({ turn }) &&
          isRevealed({ turn, nowMs }),
      )
      .map((turn) => trayRowOf({ turn, isAgentStopped })),
  ];
};
