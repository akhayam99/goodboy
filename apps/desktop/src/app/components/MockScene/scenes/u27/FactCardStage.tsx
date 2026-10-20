import { Gauge, GitBranch } from 'lucide-react';
import { FactCard } from '@goodboy/ui';
import type { FactCardSpec } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

const TRIGGER_CLASSES =
  'inline-flex h-7 items-center justify-center rounded-md border border-border-soft px-2 text-label text-muted-foreground hover:bg-hover hover:text-foreground';

const LIMITS_CARD: FactCardSpec = {
  glyph: <Gauge size={ICON_SIZE.row} />,
  title: 'Northwind limits',
  state: { tone: 'warning', words: 'Near the 5 hour limit' },
  facts: [
    { label: '5 hours', value: '82% used', note: 'resets 16:40', tone: 'warning' },
    { label: 'Week', value: '31% used', note: 'resets Fri' },
    { label: 'Spend', value: '$14.20' },
  ],
  footnote: 'Updated 14:02',
};

const CHECK_CARD: FactCardSpec = {
  glyph: <GitBranch size={ICON_SIZE.row} />,
  title: 'payments-api',
  sub: 'test',
  state: { tone: 'danger', words: 'Failed' },
  facts: [
    { label: 'Took', value: '1m 32s' },
    { label: 'Workflow', value: 'ci.yml' },
    { label: 'Branch', value: 'ledger-core/retry' },
  ],
  footnote: 'Click to open the run',
};

const RUNNING_CARD: FactCardSpec = {
  title: 'notify-relay',
  sub: 'build',
  state: { tone: 'info', words: 'Running for 40 seconds', isRunning: true },
  facts: [{ label: 'Started', value: '14:01' }],
};

export const FactCardStage = () => (
  <div
    data-testid="fact-card-stage"
    className="grid w-264 grid-cols-3 items-start gap-6 rounded-lg border border-border-soft bg-subtle p-6 pb-72"
  >
    <FactCard card={LIMITS_CARD} isOpen>
      <button type="button" className={TRIGGER_CLASSES}>
        Northwind 82%
      </button>
    </FactCard>
    <FactCard card={CHECK_CARD} isOpen>
      <button type="button" className={TRIGGER_CLASSES}>
        test failed
      </button>
    </FactCard>
    <FactCard card={RUNNING_CARD} isOpen>
      <button type="button" className={TRIGGER_CLASSES}>
        build running
      </button>
    </FactCard>
  </div>
);
