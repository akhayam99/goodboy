import { useEffect, useState } from 'react';
import type { WorkflowRules } from '@goodboy/types';
import { Band, BandRow, Input, SegmentedTabs, Switch, cn } from '@goodboy/ui';
import { parseSpendLimit } from '../../../budget/parseSpendLimit';

type Props = {
  readonly rules: WorkflowRules;
  readonly onChange: (patch: Partial<WorkflowRules>) => void;
};

const DEFAULT_CAP_USD = 25;

const MODE_OPTIONS = [
  { value: 'pause', label: 'Pause' },
  { value: 'notify', label: 'Warn only' },
] as const;

export const RulesSpendBand = ({ rules, onChange }: Props) => {
  const isOn = rules.spendLimitUsd !== null;
  const [amount, setAmount] = useState(rules.spendLimitUsd?.toString() ?? '');
  const isInvalid = isOn && parseSpendLimit(amount) === null;

  useEffect(() => {
    setAmount(rules.spendLimitUsd?.toString() ?? '');
  }, [rules.spendLimitUsd]);

  return (
    <Band label="Spend" ariaLabel="Spend" headingLevel={2}>
      <BandRow>
        <span className="flex min-w-0 flex-1 flex-col">
          <span id="rules-spend-cap" className="text-label text-foreground">
            Default cap
          </span>
          <span className="text-secondary text-muted-foreground">
            Applies to new runs. Each run can change it.
          </span>
        </span>
        <Switch
          label={<span className="sr-only">Default cap</span>}
          checked={isOn}
          onChange={(next) => onChange({ spendLimitUsd: next ? DEFAULT_CAP_USD : null })}
        />
      </BandRow>
      {isOn ? (
        <>
          <BandRow>
            <label htmlFor="rules-spend-amount" className="flex min-w-0 flex-1 flex-col">
              <span className="text-label text-foreground">Amount</span>
              <span className="text-secondary text-muted-foreground">Per run, in US dollars.</span>
            </label>
            <span className="relative w-28">
              <span
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label text-muted-foreground"
              >
                $
              </span>
              <Input
                id="rules-spend-amount"
                inputMode="decimal"
                value={amount}
                aria-invalid={isInvalid}
                onChange={(event) => setAmount(event.target.value)}
                onBlur={() => {
                  const parsed = parseSpendLimit(amount);
                  if (parsed !== null && parsed !== rules.spendLimitUsd) {
                    onChange({ spendLimitUsd: parsed });
                  }
                }}
                className={cn('pl-6 text-label', isInvalid && 'border-danger')}
              />
            </span>
          </BandRow>
          <BandRow>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-label text-foreground">At the limit</span>
              <span className="text-secondary text-muted-foreground">
                {rules.spendLimitMode === 'pause' ? 'Pauses workflows' : 'Only warns'}
              </span>
            </span>
            <SegmentedTabs
              size="sm"
              ariaLabel="At the limit"
              options={MODE_OPTIONS}
              value={rules.spendLimitMode}
              onChange={(spendLimitMode) => onChange({ spendLimitMode })}
            />
          </BandRow>
        </>
      ) : null}
    </Band>
  );
};
