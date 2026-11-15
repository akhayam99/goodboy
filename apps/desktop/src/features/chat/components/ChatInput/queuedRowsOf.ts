import type { MessageAttachment, TurnProviderOverride } from '@goodboy/types';
import type { AttachmentStripItem } from '../../../attachments/AttachmentStrip';
import {
  pendingMessageLineOf,
  type PendingMessageAction,
} from '../../../auto/chat/pendingMessageOf';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';
import { directRevealAtOf } from './directRevealAtOf';

export type QueuedRowStatus = 'queued' | 'sending' | 'waits' | 'notDelivered';

export type QueuedRow = Readonly<{
  id: string;
  source: 'agent' | 'auto';
  content: string;
  images: ReadonlyArray<AttachmentStripItem>;
  imageCount: number;
  override: TurnProviderOverride | undefined;
  status: QueuedRowStatus;
  statusText: string;
  reason: string | null;
  action: PendingMessageAction | null;
}>;

type Params = {
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly view: AutoTreeView | null;
  readonly isAgentStopped: boolean;
  readonly nowMs: number;
  readonly isAtOnce?: boolean;
};

const AGENT_QUEUED_TEXT = 'Waits for this reply';

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
  readonly isAtOnce: boolean;
};

const autoRowsOf = ({ view, isAtOnce }: AutoRowsParams): ReadonlyArray<QueuedRow> => {
  const line = pendingMessageLineOf({ view, isAtOnce });
  return [...view.pendingMessages]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((message): QueuedRow => ({
      id: message.rowId,
      source: 'auto',
      content: message.text,
      images: message.images.map((image) => autoImageOf({ image })),
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
  isAtOnce = false,
}: Params): ReadonlyArray<QueuedRow> => {
  const autoRows = view === null ? [] : autoRowsOf({ view, isAtOnce });
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
