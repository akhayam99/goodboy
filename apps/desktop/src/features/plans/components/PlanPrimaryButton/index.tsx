import { NAMES } from '../../../../shared/names';
import { Check, Play } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PlanPrimaryAction } from '../../usePlanPrimaryAction';

type Props = {
  readonly action: PlanPrimaryAction;
  readonly isReasonShown?: boolean;
};

export const PlanPrimaryButton = ({ action, isReasonShown = true }: Props) => {
  const { primary, isBusy, error, press } = action;
  if (primary.kind === 'none' || primary.label === null) {
    return null;
  }
  const isDisabled = primary.kind === 'disabled';
  const Icon = primary.label === NAMES.approve ? Check : Play;

  return (
    <>
      <Button
        variant={primary.isSecondary ? 'secondary' : 'primary'}
        size="sm"
        onClick={press}
        disabled={isDisabled}
        isBusy={isBusy}
        title={primary.reason ?? error ?? undefined}
        data-testid="plan-primary"
        data-plan-primary={primary.kind}
        data-filled={primary.isSecondary ? 'false' : 'true'}
      >
        <Icon size={ICON_SIZE.row} aria-hidden />
        {primary.label}
      </Button>
      {isDisabled && isReasonShown && primary.reason !== null ? (
        <span
          data-testid="plan-primary-reason"
          className="min-w-0 truncate text-meta text-faint-foreground"
        >
          {primary.reason}
        </span>
      ) : null}
      {error === null ? null : (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </>
  );
};
