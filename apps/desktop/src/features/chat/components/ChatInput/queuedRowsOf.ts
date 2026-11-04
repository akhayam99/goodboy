import type { MessageAttachment, TurnProviderOverride } from '@goodboy/types';
import type { AttachmentStripItem } from '../../../attachments/AttachmentStrip';
import {
  pendingMessageLineOf,
  type PendingMessageAction,
} from '../../../auto/chat/pendingMessageOf';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';

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
};

const AGENT_QUEUED_TEXT = 'Waits for this turn';

const AGENT_SENDING_TEXT = 'Sending now';

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
};

const trayRowOf = ({ turn }: TrayRowParams): QueuedRow => ({
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
  status: turn.status,
  statusText: turn.status === 'sending' ? AGENT_SENDING_TEXT : AGENT_QUEUED_TEXT,
  reason: null,
  action: null,
});

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

export const queuedRowsOf = ({ queue, view }: Params): ReadonlyArray<QueuedRow> => {
  const autoRows = view === null ? [] : autoRowsOf({ view });
  return [
    ...autoRows,
    ...queue
      .filter((turn) => !isHandedOff({ turn, autoRows, view }))
      .map((turn) => trayRowOf({ turn })),
  ];
};
