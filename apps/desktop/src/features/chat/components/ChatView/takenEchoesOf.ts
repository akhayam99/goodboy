import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import type { ConversationRow } from '../../utils/conversationRows';
import type { TranscriptItem } from '../../utils/transcript-items';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly insertions: ReadonlyArray<TranscriptInsertion>;
};

type UserTextItem = Extract<TranscriptItem, { kind: 'user_text' }>;

export type TakenEchoRow = Readonly<{
  key: string;
  item: UserTextItem;
}>;

type EchoOfParams = {
  readonly row: ConversationRow;
};

const SENT_CLOCK_SLACK_MS = 2_000;

const echoOf = ({ row }: EchoOfParams): UserTextItem | null =>
  row.kind === 'item' && row.item.kind === 'user_text' && row.item.isOperatorEcho === true
    ? row.item
    : null;

type IsDeliveredParams = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly index: number;
  readonly text: string;
};

const isDeliveredByText = ({ rows, index, text }: IsDeliveredParams): boolean =>
  rows.slice(index + 1).some((later) => {
    if (later.kind !== 'item' || later.item.kind !== 'auto_delivery') {
      return false;
    }
    return later.item.outboxIds === undefined && later.item.text.includes(text);
  });

export const takenEchoesOf = ({ rows, insertions }: Params): ReadonlyMap<string, TakenEchoRow> => {
  const takenKeys = new Set<string>();
  const taken = new Map<string, TakenEchoRow>();
  const echoes = insertions.flatMap((insertion) => insertion.takesOver ?? []);
  for (const echo of echoes) {
    const byId = rows.find((row) => {
      const item = echoOf({ row });
      return item !== null && item.outboxId === echo.key && !takenKeys.has(row.key);
    });
    const match =
      byId ??
      rows.find((row, index) => {
        const item = echoOf({ row });
        return (
          item !== null &&
          item.outboxId === undefined &&
          !takenKeys.has(row.key) &&
          item.text === echo.text &&
          Date.parse(item.at) >= echo.sentAtMs - SENT_CLOCK_SLACK_MS &&
          !isDeliveredByText({ rows, index, text: item.text })
        );
      });
    const item = match === undefined ? null : echoOf({ row: match });
    if (match !== undefined && item !== null) {
      takenKeys.add(match.key);
      taken.set(echo.key, { key: match.key, item });
    }
  }
  return taken;
};
