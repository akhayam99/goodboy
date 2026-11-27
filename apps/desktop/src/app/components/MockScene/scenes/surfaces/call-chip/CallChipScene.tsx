import { POPOVER_WIDTH_CLASS } from '@goodboy/ui';
import { CallChip } from '../../../../../../features/calendar/chip/CallChip';
import type { ChipView } from '../../../../../../features/calendar/chip/callChipTypes';
import { sceneClock } from '../../../sceneClock';

const CLOCK = sceneClock({ anchor: '2026-11-27T10:29:18.000Z' });
const NOW = CLOCK.ms({ at: '2026-11-27T10:29:18.000Z' });
const START = CLOCK.ms({ at: '2026-11-27T10:30:00.000Z' });
const END = CLOCK.ms({ at: '2026-11-27T11:02:00.000Z' });

const SOON: ChipView = {
  kind: 'soon',
  title: 'Northwind sync: payments-api rollout',
  start: START,
  host: 'meet.google.com',
  rows: [
    {
      key: 'notify-relay',
      text: 'notify-relay · 1 question for you',
      mark: { kind: 'state', state: 'question' },
      canOpen: true,
    },
    {
      key: 'payments-api',
      text: 'payments-api #412 · ready to merge',
      mark: { kind: 'state', state: 'approved' },
      canOpen: true,
    },
  ],
};

const COUNTDOWN: ChipView = {
  kind: 'countdown',
  title: 'Northwind sync',
  start: START,
  end: END,
  host: 'meet.google.com',
  people: ['Mara Acme', 'Dov Cascadia', 'Ana Harborline'],
};

const IN_CALL: ChipView = {
  kind: 'in-call',
  title: 'Northwind sync',
  end: END,
  joinedAt: NOW - 192_000,
  heldCount: 1,
};

const AFTER: ChipView = {
  kind: 'after',
  start: START,
  end: END,
  rows: [
    {
      key: 'notify-relay',
      text: 'notify-relay · migration on staging done',
      mark: { kind: 'dot', tone: 'warning' },
      canOpen: false,
    },
    {
      key: 'ledger-core',
      text: 'ledger-core · 1 question for you',
      mark: { kind: 'state', state: 'question' },
      canOpen: true,
    },
  ],
};

type FrameParams = {
  readonly view: ChipView;
};

const ignore = (): void => undefined;

const frameOf = ({ view }: FrameParams) => (
  <div className="flex min-h-screen justify-center bg-background p-6">
    <div className={POPOVER_WIDTH_CLASS.wide}>
      <CallChip view={view} now={NOW} hasFailed={false} onAct={ignore} />
    </div>
  </div>
);

export const CALL_CHIP_SCENES = {
  'call-chip-soon': () => frameOf({ view: SOON }),
  'call-chip-countdown': () => frameOf({ view: COUNTDOWN }),
  'call-chip-in-call': () => frameOf({ view: IN_CALL }),
  'call-chip-after': () => frameOf({ view: AFTER }),
};
