import { Bell, Pause } from 'lucide-react';
import { Input, SegmentedTabs, cn, type SegmentedTabOption } from '@goodboy/ui';
import type { SessionBudgetOnExceed } from '@goodboy/types';
import { parseSpendLimit } from '../parseSpendLimit';

const BEHAVIOR_OPTIONS: ReadonlyArray<SegmentedTabOption<SessionBudgetOnExceed>> = [
  { value: 'pause', label: 'Pause workflows', hint: 'Stop at the limit', icon: Pause },
  { value: 'warn', label: 'Warn only', hint: 'Keep going, notify once', icon: Bell },
];

type Props = {
  readonly amount: string;
  readonly behavior: SessionBudgetOnExceed;
  readonly inputId: string;
  readonly invalid?: boolean;
  readonly onAmount: (amount: string) => void;
  readonly onBehavior: (behavior: SessionBudgetOnExceed) => void;
};

export const SpendLimitFields = ({
  amount,
  behavior,
  inputId,
  invalid = false,
  onAmount,
  onBehavior,
}: Props) => (
  <div className="flex flex-col gap-2">
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label text-muted-foreground"
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
        className={cn('pl-6 text-label', invalid && 'border-danger')}
      />
    </div>
    {parseSpendLimit(amount) != null && (
      <SegmentedTabs
        fill
        size="sm"
        ariaLabel="What happens at the limit"
        options={BEHAVIOR_OPTIONS}
        value={behavior}
        onChange={onBehavior}
      />
    )}
  </div>
);
