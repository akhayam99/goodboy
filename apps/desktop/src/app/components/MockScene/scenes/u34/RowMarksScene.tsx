import { UNREAD_TITLE, cn } from '@goodboy/ui';
import { StateNode, type StateNodeSpec } from '../../../../../shared/components/StateNode';

type Row = {
  readonly title: string;
  readonly node: StateNodeSpec;
};

const RING_ONLY = { kind: 'glyph', glyph: null } as const;

const QUESTION: StateNodeSpec = {
  kind: 'needs',
  state: 'question',
  mark: RING_ONLY,
  tone: 'warning',
  label: 'Needs you',
  isSpinning: false,
  hasUnread: false,
};

const RUNNING: StateNodeSpec = {
  kind: 'running',
  state: 'running',
  mark: { kind: 'dot' },
  tone: 'info',
  label: 'Running',
  isSpinning: false,
  hasUnread: false,
};

const IDLE: StateNodeSpec = {
  kind: 'idle',
  state: 'marker',
  mark: RING_ONLY,
  tone: 'neutral',
  label: 'Building',
  isSpinning: false,
  hasUnread: false,
};

const ROWS: ReadonlyArray<Row> = [
  { title: 'Fix the rounding drift in the ledger-core export', node: QUESTION },
  { title: 'Stop retried webhooks posting twice', node: { ...QUESTION, hasUnread: true } },
  { title: 'Speed up the payout export for Northwind', node: RUNNING },
  { title: 'Nightly reconciliation before the Acme cutoff', node: RUNNING },
  { title: 'Draft the payout delay notice', node: { ...IDLE, hasUnread: true } },
  { title: 'Per-tenant limits on the payments-api', node: IDLE },
  { title: 'Reconcile the settlement export', node: IDLE },
  { title: 'Rotate the processor signing key', node: IDLE },
];

export const RowMarksScene = () => (
  <div data-shot className="flex w-[300px] flex-col gap-px bg-background p-2 text-foreground">
    {ROWS.map((row) => (
      <div key={row.title} data-row-mark className="flex h-7 items-center gap-2 px-2">
        <StateNode node={row.node} hasEmptySlot />
        <span
          className={cn('min-w-0 flex-1 truncate', row.node.hasUnread ? UNREAD_TITLE : 'text-ui')}
        >
          {row.title}
        </span>
      </div>
    ))}
  </div>
);
