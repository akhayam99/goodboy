import { formatTokens, MetaRow, TEXT_ROLE } from '@goodboy/ui';
import type { SendRow } from './sendRowsOf';

type Props = {
  readonly row: SendRow;
  readonly note?: string;
};

export const SendRoleRow = ({ row, note }: Props) => (
  <div data-send-row={row.key} className="flex items-start gap-3 rounded-lg px-2 py-2">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="truncate">{row.label}</span>
      <MetaRow
        items={row.parts.map((part) => (
          <span
            key={part.key}
            data-send-part={part.key}
            className={part.isEmpty ? TEXT_ROLE.hint : 'tabular-nums'}
          >
            {part.isEmpty ? part.label : `${part.label} ${formatTokens(part.tokens)}`}
          </span>
        ))}
      />
      {note === undefined ? null : <span className={TEXT_ROLE.hint}>{note}</span>}
    </div>
    <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
      {`${formatTokens(row.tokens)} tokens`}
    </span>
  </div>
);
