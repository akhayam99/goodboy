import { Divider, Switch, cn } from '@goodboy/ui';
import type { WorkflowSpendLimitMode } from '@goodboy/types';
import {
  SpendLimitFields,
  parseSpendLimit,
} from '../../../workflows/components/RunSpendLimitPopover/SpendLimitFields';

type Props = {
  readonly enabled: boolean;
  readonly amount: string;
  readonly mode: WorkflowSpendLimitMode;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly onEnabled: (enabled: boolean) => void;
  readonly onAmount: (amount: string) => void;
  readonly onMode: (mode: WorkflowSpendLimitMode) => void;
};

export const SpendLimitDisclosure = ({
  enabled,
  amount,
  mode,
  invalid,
  disabled,
  onEnabled,
  onAmount,
  onMode,
}: Props) => {
  const hasAmount = parseSpendLimit(amount) != null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border-soft',
        enabled ? 'bg-subtle/60' : 'bg-subtle/40',
      )}
    >
      <div className="flex items-center justify-between gap-4 p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Spend limit</span>
          <span className="text-2xs leading-relaxed text-muted-foreground">
            Cap this run before it starts.
          </span>
        </div>
        <Switch
          label={
            <>
              <span className="sr-only">Spend limit </span>
              {enabled ? 'On' : 'Off'}
            </>
          }
          checked={enabled}
          disabled={disabled}
          onChange={onEnabled}
          className="shrink-0"
        />
      </div>
      {enabled && (
        <>
          <Divider />
          <div className="flex flex-col gap-2 p-3">
            <label
              htmlFor="builder-spend-limit-amount"
              className="text-2xs font-medium text-foreground"
            >
              Budget
            </label>
            <SpendLimitFields
              amount={amount}
              mode={mode}
              inputId="builder-spend-limit-amount"
              invalid={invalid}
              onAmount={onAmount}
              onMode={onMode}
            />
            <p
              className={cn(
                'text-2xs leading-relaxed',
                invalid ? 'text-danger' : 'text-muted-foreground',
              )}
            >
              {invalid
                ? 'Enter an amount above zero.'
                : hasAmount
                  ? 'Choose whether the run notifies you or pauses at this amount.'
                  : 'Set the maximum this run may spend.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
