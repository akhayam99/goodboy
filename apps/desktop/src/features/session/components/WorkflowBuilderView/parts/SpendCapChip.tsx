import { AnchoredPopover, Switch, cn, formatUsd, useDropdown } from '@goodboy/ui';
import type { WorkflowSpendLimitMode } from '@goodboy/types';
import {
  SpendLimitFields,
  parseSpendLimit,
} from '../../../../workflows/components/RunSpendLimitPopover/SpendLimitFields';
import { ControlChip } from './ControlChip';

type Props = {
  readonly isEnabled: boolean;
  readonly amount: string;
  readonly mode: WorkflowSpendLimitMode;
  readonly isInvalid: boolean;
  readonly disabled: boolean;
  readonly onEnabled: (isEnabled: boolean) => void;
  readonly onAmount: (amount: string) => void;
  readonly onMode: (mode: WorkflowSpendLimitMode) => void;
};

const AMOUNT_ID = 'builder-spend-limit-amount';

type ValueParams = {
  readonly isEnabled: boolean;
  readonly amount: string;
  readonly mode: WorkflowSpendLimitMode;
};

const chipValueOf = ({ isEnabled, amount, mode }: ValueParams): string => {
  if (!isEnabled) {
    return 'None';
  }
  const parsed = parseSpendLimit(amount);
  return parsed === null ? 'Set an amount' : `${formatUsd(parsed)}, ${mode}`;
};

export const SpendCapChip = ({
  isEnabled,
  amount,
  mode,
  isInvalid,
  disabled,
  onEnabled,
  onAmount,
  onMode,
}: Props) => {
  const dropdown = useDropdown({ disabled, width: 'w-72' });
  const { open, toggle } = dropdown;
  const hasAmount = parseSpendLimit(amount) != null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Spend cap"
      className="flex flex-col gap-2 p-3"
      trigger={
        <ControlChip
          label="Spend cap"
          value={chipValueOf({ isEnabled, amount, mode })}
          isOpen={open}
          isInvalid={isInvalid}
          disabled={disabled}
          onToggle={toggle}
        />
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-secondary text-muted-foreground">Cap this run before it starts.</span>
        <Switch
          label={
            <>
              <span className="sr-only">Spend limit </span>
              {isEnabled ? 'On' : 'Off'}
            </>
          }
          checked={isEnabled}
          disabled={disabled}
          onChange={onEnabled}
          className="shrink-0"
        />
      </div>
      {isEnabled ? (
        <>
          <SpendLimitFields
            amount={amount}
            mode={mode}
            inputId={AMOUNT_ID}
            invalid={isInvalid}
            onAmount={onAmount}
            onMode={onMode}
          />
          <p
            className={cn(
              'text-2xs leading-relaxed',
              isInvalid ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            {isInvalid
              ? 'Enter an amount above zero.'
              : hasAmount
                ? 'Choose whether the run notifies you or pauses at this amount.'
                : 'Set the maximum this run may spend.'}
          </p>
        </>
      ) : null}
    </AnchoredPopover>
  );
};
