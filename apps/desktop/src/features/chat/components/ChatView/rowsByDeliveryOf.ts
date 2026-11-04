import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly insertions?: ReadonlyArray<Pick<TranscriptInsertion, 'keptEchoIds'>>;
};

type RowParams = {
  readonly row: ConversationRow;
};

type IsDeliveryOfParams = {
  readonly echo: ConversationRow;
  readonly delivery: ConversationRow;
};

const echoOf = ({ row }: RowParams) =>
  row.kind === 'item' && row.item.kind === 'user_text' && row.item.isOperatorEcho === true
    ? row.item
    : null;

const isDeliveryOf = ({ echo, delivery }: IsDeliveryOfParams): boolean => {
  const sent = echoOf({ row: echo });
  if (sent === null || sent.text === '') {
    return false;
  }
  if (delivery.kind !== 'item' || delivery.item.kind !== 'auto_delivery') {
    return false;
  }
  if (sent.outboxId !== undefined) {
    return delivery.item.outboxIds?.includes(sent.outboxId) === true;
  }
  return delivery.item.outboxIds === undefined && delivery.item.text.includes(sent.text);
};

export const rowsByDeliveryOf = ({
  rows,
  insertions = [],
}: Params): ReadonlyArray<ConversationRow> => {
  const keptEchoIds = insertions.flatMap((insertion) => insertion.keptEchoIds ?? []);
  const movedBefore = new Map<string, ConversationRow[]>();
  const movedKeys = new Set<string>();
  const unreadKeys = new Set<string>();
  rows.forEach((row, index) => {
    const delivery = rows
      .slice(index + 1)
      .find((later) => isDeliveryOf({ echo: row, delivery: later }));
    if (delivery !== undefined) {
      movedKeys.add(row.key);
      movedBefore.set(delivery.key, [...(movedBefore.get(delivery.key) ?? []), row]);
      return;
    }
    const outboxId = echoOf({ row })?.outboxId;
    if (outboxId !== undefined && !keptEchoIds.includes(outboxId)) {
      unreadKeys.add(row.key);
    }
  });
  return rows.flatMap((row) => {
    if (movedKeys.has(row.key) || unreadKeys.has(row.key)) {
      return [];
    }
    return [...(movedBefore.get(row.key) ?? []), row];
  });
};
