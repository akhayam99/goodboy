import { RotateCcw } from 'lucide-react';
import { AnchoredPopover, Switch, cn, formatUsd, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { WorkflowSpendLimitMode } from '@goodboy/types';
import { NAMES } from '../../../../../shared/names';
import { SpendLimitFields } from '../../../../budget/components/SpendLimitFields';
import { parseSpendLimit } from '../../../../budget/parseSpendLimit';
import {
  SPEND_LIMIT_BEHAVIOR_SHORT,
  behaviorOfRunMode,
  runModeOfBehavior,
} from '../../../../budget/spendLimitBehavior';
import { ControlChip } from './ControlChip';
import { RuleDot } from './RuleDot';

type Props = {
  readonly isEnabled: boolean;
  readonly amount: string;
  readonly mode: WorkflowSpendLimitMode;
  readonly isInvalid: boolean;
  readonly rule: ValueParams;
  readonly disabled: boolean;
  readonly onEnabled: (isEnabled: boolean) => void;
  readonly onAmount: (amount: string) => void;
  readonly onMode: (mode: WorkflowSpendLimitMode) => void;
  readonly onReset: () => void;
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
  return parsed === null
    ? 'Set an amount'
    : `${formatUsd(parsed)} · ${SPEND_LIMIT_BEHAVIOR_SHORT[behaviorOfRunMode({ mode })]}`;
};

const sameSpend = ({ left, right }: { readonly left: ValueParams; readonly right: ValueParams }) =>
  left.isEnabled === right.isEnabled &&
  (!left.isEnabled ||
    (parseSpendLimit(left.amount) === parseSpendLimit(right.amount) && left.mode === right.mode));

export const SpendCapChip = ({
  isEnabled,
  amount,
  mode,
  isInvalid,
  rule,
  disabled,
  onEnabled,
  onAmount,
  onMode,
  onReset,
}: Props) => {
  const differs = !sameSpend({ left: { isEnabled, amount, mode }, right: rule });
  const ruleValue = chipValueOf(rule);
  const dropdown = useDropdown({ disabled, width: 'w-72' });
  const { open, toggle } = dropdown;
  const hasAmount = parseSpendLimit(amount) != null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={NAMES.spendCap}
      className="flex flex-col gap-2 p-3"
      trigger={
        <ControlChip
          label={NAMES.spendCap}
          value={chipValueOf({ isEnabled, amount, mode })}
          marker={differs ? <RuleDot ruleValue={ruleValue} /> : null}
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
              <span className="sr-only">{NAMES.spendCap} </span>
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
            behavior={behaviorOfRunMode({ mode })}
            inputId={AMOUNT_ID}
            invalid={isInvalid}
            onAmount={onAmount}
            onBehavior={(behavior) => onMode(runModeOfBehavior({ behavior }))}
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
                ? 'Choose whether the run pauses or only warns you at this amount.'
                : 'Set the maximum this run may spend.'}
          </p>
        </>
      ) : null}
      {differs ? (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-md px-1 py-1 text-left text-label text-foreground hover:bg-hover"
        >
          <RotateCcw size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">Reset</span>
          <span className="truncate text-secondary text-faint-foreground">{ruleValue}</span>
        </button>
      ) : null}
    </AnchoredPopover>
  );
};
