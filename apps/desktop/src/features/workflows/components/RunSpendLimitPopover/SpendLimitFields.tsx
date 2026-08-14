import { Bell, Pause } from 'lucide-react';
import { Input, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { WorkflowSpendLimitMode } from '@goodboy/types';

const MODE_OPTIONS: ReadonlyArray<SegmentedTabOption<WorkflowSpendLimitMode>> = [
  { value: 'notify', label: 'Notify', hint: 'keep going, warn me', icon: Bell },
  { value: 'pause', label: 'Pause', hint: 'stop the run', icon: Pause },
];

export const parseSpendLimit = (draft: string): number | null => {
  const amount = Number.parseFloat(draft.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

type Props = {
  readonly amount: string;
  readonly mode: WorkflowSpendLimitMode;
  readonly inputId: string;
  readonly onAmount: (amount: string) => void;
  readonly onMode: (mode: WorkflowSpendLimitMode) => void;
};

export const SpendLimitFields = ({ amount, mode, inputId, onAmount, onMode }: Props) => (
  <div className="flex flex-col gap-2">
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
      >
        $
      </span>
      <Input
        id={inputId}
        type="number"
        min="0"
        step="1"
        inputMode="decimal"
        value={amount}
        placeholder="no limit"
        aria-label="Spend limit in dollars"
        data-testid="spend-limit-amount"
        onChange={(event) => onAmount(event.target.value)}
        className="pl-6 text-xs"
      />
    </div>
    <SegmentedTabs
      fill
      size="sm"
      ariaLabel="What happens at the limit"
      options={MODE_OPTIONS}
      value={mode}
      onChange={onMode}
    />
  </div>
);
