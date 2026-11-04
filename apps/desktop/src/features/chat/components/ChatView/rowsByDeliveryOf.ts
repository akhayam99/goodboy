import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly insertions: ReadonlyArray<TranscriptInsertion>;
};

type EchoParams = {
  readonly row: ConversationRow;
};

const SENT_CLOCK_SLACK_MS = 2_000;

const echoTextOf = ({ row }: EchoParams): string | null =>
  row.kind === 'item' && row.item.kind === 'user_text' && row.item.isOperatorEcho === true
    ? row.item.text
    : null;

const deliveryTextOf = ({ row }: EchoParams): string | null =>
  row.kind === 'item' && row.item.kind === 'auto_delivery' ? row.item.text : null;

const atMsOf = ({ row }: EchoParams): number =>
  row.kind === 'item' && row.item.kind === 'user_text' ? Date.parse(row.item.at) : 0;

export const rowsByDeliveryOf = ({ rows, insertions }: Params): ReadonlyArray<ConversationRow> => {
  const taken = insertions.flatMap((insertion) => insertion.takesOver ?? []);
  const takenKeys = new Set<string>();
  for (const echo of taken) {
    const match = rows.find(
      (row) =>
        !takenKeys.has(row.key) &&
        echoTextOf({ row }) === echo.text &&
        atMsOf({ row }) >= echo.sentAtMs - SENT_CLOCK_SLACK_MS,
    );
    if (match !== undefined) {
      takenKeys.add(match.key);
    }
  }
  const kept = rows.filter((row) => !takenKeys.has(row.key));
  const movedBefore = new Map<string, ConversationRow[]>();
  const movedKeys = new Set<string>();
  kept.forEach((row, index) => {
    const text = echoTextOf({ row });
    if (text === null || text === '') {
      return;
    }
    const delivery = kept.slice(index + 1).find((later) => {
      const deliveryText = deliveryTextOf({ row: later });
      return deliveryText !== null && deliveryText.includes(text);
    });
    if (delivery === undefined || kept[index + 1] === delivery) {
      return;
    }
    movedKeys.add(row.key);
    movedBefore.set(delivery.key, [...(movedBefore.get(delivery.key) ?? []), row]);
  });
  return kept.flatMap((row) => {
    if (movedKeys.has(row.key)) {
      return [];
    }
    return [...(movedBefore.get(row.key) ?? []), row];
  });
};
