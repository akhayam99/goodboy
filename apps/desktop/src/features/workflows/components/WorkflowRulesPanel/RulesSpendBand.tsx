import { useEffect, useState } from 'react';
import type { WorkflowRules } from '@goodboy/types';
import { Band, BandRow, Input, SegmentedTabs, Switch, cn } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
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
    <Band label={NAMES.spendCap} ariaLabel={NAMES.spendCap} headingLevel={3}>
      <BandRow>
        <span className="min-w-0 flex-1 text-row text-foreground">Cap what a run can spend</span>
        <Switch
          label={<span className="sr-only">{NAMES.spendCap}</span>}
          checked={isOn}
          onChange={(next) => onChange({ spendLimitUsd: next ? DEFAULT_CAP_USD : null })}
        />
      </BandRow>
      {isOn ? (
        <>
          <BandRow>
            <label htmlFor="rules-spend-amount" className="min-w-0 flex-1 text-row text-foreground">
              Amount per run
            </label>
            <span className="relative w-28">
              <span
                aria-hidden
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-label text-muted-foreground"
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
            <span className="min-w-0 flex-1 text-row text-foreground">At the limit</span>
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
