import { ListGrid, ListGridRow, TruncatedText, cn, type ListGridColumn } from '@goodboy/ui';
import { isFailedRequest, networkStatusWordOf } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry } from '../../types';
import { NetworkWaterfall } from './NetworkWaterfall';
import { requestFactsOf } from './requestFactsOf';
import { requestKeyOf } from './requestKeyOf';

type OpenParams = {
  readonly entry: BrowserConsoleEntry;
};

type Props = {
  readonly rows: ReadonlyArray<BrowserConsoleEntry>;
  readonly opened: BrowserConsoleEntry | null;
  readonly isNarrow: boolean;
  readonly onOpen: (params: OpenParams) => void;
};

const WIDE_COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'method', width: 56 },
  { key: 'path', width: 'fill', isTitle: true },
  { key: 'status', width: 52 },
  { key: 'type', width: 52 },
  { key: 'size', width: 64, align: 'end', isNumeric: true },
  { key: 'time', width: 64, align: 'end', isNumeric: true },
  { key: 'waterfall', width: 160, isShrinkable: true },
];

const NARROW_KEYS: ReadonlySet<string> = new Set(['method', 'path', 'status']);

const NARROW_COLUMNS = WIDE_COLUMNS.filter((column) => NARROW_KEYS.has(column.key));

const HEADINGS = {
  method: 'Method',
  path: 'Path',
  status: 'Status',
  type: 'Type',
  size: 'Size',
  time: 'Time',
  waterfall: 'Waterfall',
} as const;

const TYPE_WORD = {
  fetch: 'fetch',
  xhr: 'xhr',
  doc: 'doc',
  script: 'js',
  style: 'css',
  img: 'img',
  ws: 'ws',
  sse: 'sse',
  other: 'other',
} as const;

type SpanParams = Pick<Props, 'rows'>;

const spanOf = ({ rows }: SpanParams): number =>
  rows.reduce((latest, row) => {
    const facts = row.network;
    if (facts === null) {
      return latest;
    }
    return Math.max(latest, facts.start + (facts.duration ?? 0));
  }, 0);

export const NetworkTable = ({ rows, opened, isNarrow, onOpen }: Props) => {
  const span = spanOf({ rows });
  const headings = Object.fromEntries(
    Object.entries(HEADINGS).map(([key, label]) => [
      key,
      <span key={key} className="text-eyebrow text-faint-foreground">
        {label}
      </span>,
    ]),
  );
  return (
    <ListGrid
      label="Requests"
      columns={isNarrow ? NARROW_COLUMNS : WIDE_COLUMNS}
      className="px-1 text-code"
    >
      <ListGridRow rowHeight={28} cells={{ byKey: headings }} />
      {rows.map((entry) => {
        const facts = requestFactsOf({ entry });
        const isFailed = isFailedRequest({ status: entry.status });
        const method = entry.method ?? 'GET';
        const status = networkStatusWordOf({ status: entry.status });
        const tone = isFailed ? 'text-danger' : 'text-foreground';
        return (
          <ListGridRow
            key={requestKeyOf({ entry })}
            rowKey={requestKeyOf({ entry })}
            rowHeight={28}
            isSelected={entry === opened}
            ariaLabel={`${method} ${entry.text}, ${status}`}
            onSelect={() => onOpen({ entry })}
            cells={{
              byKey: {
                method: <span className="text-code text-muted-foreground">{method}</span>,
                path: <TruncatedText className={cn('text-code', tone)}>{entry.text}</TruncatedText>,
                status: <span className={cn('text-code', tone)}>{status}</span>,
                type: (
                  <span className="text-code text-muted-foreground">
                    {TYPE_WORD[entry.network?.type ?? 'other']}
                  </span>
                ),
                size: <span className="text-code text-muted-foreground">{facts.size ?? ''}</span>,
                time: <span className="text-code text-muted-foreground">{facts.time}</span>,
                waterfall: <NetworkWaterfall entry={entry} span={span} />,
              },
            }}
          />
        );
      })}
    </ListGrid>
  );
};
