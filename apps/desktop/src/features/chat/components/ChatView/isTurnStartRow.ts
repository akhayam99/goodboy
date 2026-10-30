import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly row: ConversationRow;
  readonly previous: ConversationRow | undefined;
};

type RowParams = {
  readonly row: ConversationRow | undefined;
};

const isEcho = ({ row }: RowParams): boolean =>
  row?.kind === 'item' && row.item.kind === 'user_text' && row.item.isOperatorEcho === true;

const isDelivery = ({ row }: RowParams): boolean =>
  row?.kind === 'item' && row.item.kind === 'auto_delivery';

const isEchoPairTail = ({ row, previous }: Params): boolean =>
  (isEcho({ row }) && isDelivery({ row: previous })) ||
  (isDelivery({ row }) && isEcho({ row: previous }));

export const isTurnStartRow = ({ row, previous }: Params): boolean =>
  row.kind === 'item' &&
  (row.item.kind === 'user_text' ||
    row.item.kind === 'handoff' ||
    row.item.kind === 'auto_delivery') &&
  !isEchoPairTail({ row, previous });
