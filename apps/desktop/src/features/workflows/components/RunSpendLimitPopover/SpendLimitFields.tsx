import { Bell, Pause } from 'lucide-react';
import { Input, SegmentedTabs, cn, type SegmentedTabOption } from '@goodboy/ui';
import type { WorkflowSpendLimitMode } from '@goodboy/types';

const MODE_OPTIONS: ReadonlyArray<SegmentedTabOption<WorkflowSpendLimitMode>> = [
  { value: 'notify', label: 'Notify', hint: 'keep going, warn me', icon: Bell },
  { value: 'pause', label: 'Pause', hint: 'stop the run', icon: Pause },
];

const DISABLED_MODE_OPTIONS = MODE_OPTIONS.map((option) => ({ ...option, disabled: true }));

export const parseSpendLimit = (draft: string): number | null => {
  const amount = Number.parseFloat(draft.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

type Props = {
  readonly amount: string;
  readonly mode: WorkflowSpendLimitMode;
  readonly inputId: string;
  readonly invalid?: boolean;
  readonly onAmount: (amount: string) => void;
  readonly onMode: (mode: WorkflowSpendLimitMode) => void;
};

export const SpendLimitFields = ({
  amount,
  mode,
  inputId,
  invalid = false,
  onAmount,
  onMode,
}: Props) => (
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
        aria-invalid={invalid}
        data-testid="spend-limit-amount"
        onChange={(event) => onAmount(event.target.value)}
        className={cn('pl-6 text-xs', invalid && 'border-danger')}
      />
    </div>
    <SegmentedTabs
      fill
      size="sm"
      ariaLabel="What happens at the limit"
      options={parseSpendLimit(amount) == null ? DISABLED_MODE_OPTIONS : MODE_OPTIONS}
      value={mode}
      onChange={onMode}
    />
  </div>
);
